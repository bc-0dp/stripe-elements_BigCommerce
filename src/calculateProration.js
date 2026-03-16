export function getBillingAnchor() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

export default function calculateProration(fullPrice) {
    const now = new Date();

    // Billing anchor = 1st of next month (adjust to your cycle)
    const anchor = getBillingAnchor();

    const msInDay = 1000 * 60 * 60 * 24;
    const daysRemaining = Math.ceil((anchor - now) / msInDay);
    const daysInPeriod = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
    ).getDate();

    const prorated = (daysRemaining / daysInPeriod) * fullPrice;

    return Math.round(prorated * 100) / 100; // round to 2dp
}
