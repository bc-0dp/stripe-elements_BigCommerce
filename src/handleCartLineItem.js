import calculateProration, { getBillingAnchor } from "./calculateProration.js";
import { set } from "./store.js";

export default async function handleCartLineItem(req, res) {
    const { cartId, id } = req.body.data;

    console.log(`Handling line item ${id} in cart ${cartId}`);

    // fetch the cart from bigcommerce, identify the original_price of the line item, and the SKU to determine if it's a subscription product
    const cartResponse = await fetch(
        `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/carts/${cartId}`,
        {
            method: "GET",
            headers: {
                "X-Auth-Token": process.env.BC_API_TOKEN,
                "Content-Type": "application/json",
                accept: "application/json",
            },
        },
    );

    const cartData = await cartResponse.json();
    const lineItem = cartData.data.line_items.digital_items.find(
        (item) => item.id === id,
    );

    const list_price = lineItem.list_price;
    const sku = lineItem.sku;

    console.log(`Line item SKU: ${sku}, base price: ${list_price}`);

    if (!sku.includes("price_")) {
        console.log(
            `Line item ${id} is not a subscription product, skipping proration.`,
        );
        return;
    }

    const proratedPrice = calculateProration(list_price);

    console.log(`Prorated price for line item ${id}: ${proratedPrice}`);

    set(cartId, {
        billingAnchor: getBillingAnchor(), // store as unix timestamp
        lineItems: [{ id, sku, proratedPrice }],
    });

    const cartUpdate = await fetch(
        `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/carts/${cartId}/items/${id}`,
        {
            method: "PUT",
            headers: {
                "X-Auth-Token": process.env.BC_API_TOKEN,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                line_item: {
                    product_id: lineItem.product_id,
                    list_price: proratedPrice, // overrides the catalog price
                    quantity: lineItem.quantity,
                },
            }),
        },
    );

    const cartUpdateData = await cartUpdate.json();

    console.log(cartUpdateData);
}
