export default async function createOrder(req) {
    const createOrder = await fetch(
        `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/checkouts/${req.query.cartId}/orders`,
        {
            method: "POST",
            headers: {
                "X-Auth-Token": process.env.BC_API_TOKEN,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                maxUses: 1,
                ttl: 86400
            }),
        },
    );

    return createOrder;
}
