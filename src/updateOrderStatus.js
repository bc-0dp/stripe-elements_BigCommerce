export default async function updateOrderStatus(req) {
    const updateOrderStatus = await fetch(
        `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${req.query.orderId}`,
        {
            method: "PUT",
            headers: {
                "X-Auth-Token": process.env.BC_API_TOKEN,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                status_id: 11,
                payment_method: "Credit Card (via Stripe)",
                payment_provider_id: req.query.paymentIntentId
            }),
        },
    );

    return updateOrderStatus;
}
