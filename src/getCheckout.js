export default async function getCheckout(req) {
    const checkoutToken = await fetch(
        `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v3/checkouts/${req.query.cartId}`,
        {
            method: "GET",
            headers: {
                "X-Auth-Token": process.env.BC_API_TOKEN,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        },
    );

    return checkoutToken;
}
