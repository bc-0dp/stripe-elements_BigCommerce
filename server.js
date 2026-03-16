import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import stripe from "stripe";
import getCheckout from "./src/getCheckout.js";
import getCheckoutToken from "./src/getCheckoutToken.js";
import createOrder from "./src/createOrder.js";
import handleCartLineItem from "./src/handleCartLineItem.js";
import calculateProration from "./src/calculateProration.js";
import updateOrderStatus from "./src/updateOrderStatus.js";
import { set, get, del } from "./src/store.js";

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

        set(`${req.query.cartId}`, {
                customer: customer
        }); 
        
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
        const stored = get(req.query.cartId);
        console.log("stored:", JSON.stringify(stored, null, 2));
    
        const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
        const updateOrderStatusResponse = await updateOrderStatus(req);
        
        if (updateOrderStatusResponse.ok) {
            const stored = get(req.query.cartId);
            const paymentIntent = await stripeClient.paymentIntents.retrieve(req.query.paymentIntentId);
            const paymentMethodId = paymentIntent.payment_method;
            
            const subscription =
                await stripeClient.subscriptions.create({
                    customer: stored.customer.id,
                    items: [{ price: stored.lineItems[0].sku }], // price_ stored as SKU
                    default_payment_method: paymentMethodId,
                    billing_cycle_anchor: Math.floor(stored.billingAnchor / 1000), // same anchor used in proration calc
                    proration_behavior: "none", // proration already handled upfront — don't double-charge
                });
            
            console.log(`Subscription created in Stripe with ID: ${subscription.id}`);

            return res.redirect(301, `${process.env.BC_STORE_URL}/checkout/order-confirmation/${req.query.orderId}?t=${req.query.checkoutToken}`);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// store/cart/lineItem/created
app.post("/webhooks", async (req, res) => {
    res.sendStatus(200);

    const scope = req.body.scope;
    if (scope === "store/cart/lineItem/created") {
        await handleCartLineItem(req, res);
        
    }
});

// This is useful for PDP price display when you want to show the prorated amount before checkout
app.get("/prorated-amount", async (req, res) => {

    const base_price = req.query.base_price;

    res.status(200).json({
        proratedAmount: calculateProration(base_price), // example full price
    });
});


app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
