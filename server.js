import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import stripe from "stripe";
import getCheckout from "./src/getCheckout.js";
import getCheckoutToken from "./src/getCheckoutToken.js";
import createOrder from "./src/createOrder.js";
import updateOrderStatus from "./src/updateOrderStatus.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Sample route
app.get("/", (req, res) => {
    res.json("Hello, World!");
});

app.get("/setup-intent", async (req, res) => {
    try {
        const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

        // 1. Get checkout details from BigCommerce
        const checkoutResponse = await getCheckout(req);
        const checkoutData = await checkoutResponse.json();

        // 2. Create a BigCommerce checkout token
        const checkoutTokenResponse = await getCheckoutToken(req);
        const checkoutTokenData = await checkoutTokenResponse.json();

        // 3. Create an Incomplete BigCommerce Order
        const orderResponse = await createOrder(req);
        const orderData = await orderResponse.json();

        // 4. Create or retrieve Stripe Customer
        const customerResponse = await stripeClient.customers.search({
            query: `email:'${checkoutData.data.billing_address.email}'`,
        });

        let customer;
        if (customerResponse.data.length > 0) {
            customer = customerResponse.data[0];
        } else {
            // NOTE: More attributes from checkoutData can be used to create the customer
            customer = await stripeClient.customers.create({
                email: checkoutData.data.billing_address.email,
            });
        }

        // 5. Create Stripe PaymentIntent
        const paymentIntent = await stripeClient.paymentIntents.create({
            customer: customer.id,
            amount: Math.round(checkoutData.data.grand_total * 100), // amount in cents
            currency: checkoutData.data.cart.currency.code.toLowerCase(),
            setup_future_usage: "off_session",
            automatic_payment_methods: {
                enabled: true,
            },
            // TODO: level3 data https://docs.stripe.com/api/payment_intents/create?lang=curl#create_payment_intent-amount_details-line_items
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            checkoutToken: checkoutTokenData.data.checkoutToken,
            orderId: orderData.data.id,
            paymentIntentId: paymentIntent.id,
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/complete-order", async (req, res) => {
    try {
        const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

        // Fetch cart before updating order status — cart is deleted once the order is completed
        const cartResponse = await fetch(
            `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/carts/${req.query.cartId}`,
            {
                headers: {
                    "X-Auth-Token": process.env.BC_API_TOKEN,
                    "Content-Type": "application/json",
                },
            }
        );
        const cartData = await cartResponse.json();
        const subscriptionItem = cartData.data.line_items.digital_items.find(
            (item) => item.sku.startsWith("price_")
        );

        const [updateOrderStatusResponse, paymentIntent] = await Promise.all([
            updateOrderStatus(req),
            stripeClient.paymentIntents.retrieve(req.query.paymentIntentId),
        ]);

        if (updateOrderStatusResponse.ok) {
            const paymentMethodId = paymentIntent.payment_method;

            const subscription = await stripeClient.subscriptions.create({
                customer: paymentIntent.customer,
                items: [{ price: subscriptionItem.sku }],
                default_payment_method: paymentMethodId,
                proration_behavior: "create_prorations",
            });

            console.log(`Subscription created in Stripe with ID: ${subscription.id}`);

            return res.redirect(301, `${process.env.BC_STORE_URL}/checkout/order-confirmation/${req.query.orderId}?t=${req.query.checkoutToken}`);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});




app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
