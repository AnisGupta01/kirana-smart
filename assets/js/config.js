/* ============================================================
   KIRANA SMART - STORE CONFIGURATION
   ------------------------------------------------------------
   This is the ONLY file you need to edit to customise the demo
   for a real shop. Save the file, refresh the page, done.

   HOW TO CUSTOMISE
   1. storeName / storeLocation  -> shown in the header and in
      the WhatsApp order message.
   2. whatsappNumber -> the shop's WhatsApp number where orders
      are sent. Use digits only, with country code and no "+".
      Example format: 91XXXXXXXXXX  (91 = India, then 10 digits).
      The value below is a PLACEHOLDER. Until you replace it with
      a real number, checkout will show a friendly error instead
      of opening WhatsApp.
   3. deliveryFee / freeDeliveryAbove -> delivery charge in INR.
      Set deliveryFee to 0 for free delivery.
   4. brandColor -> main dark-green colour (hex like #14532d).

   DEMO NOTE
   The shop owner can also change some of these values from the
   demo dashboard (admin.html > Settings). Those changes are saved
   only in that one browser on that one device. To make a change
   permanent for every customer, edit this file and redeploy.
   ============================================================ */
window.KS_CONFIG = {
  /* Branding */
  brandName: "Kirana Smart",
  brandColor: "#14532d",
  currency: "₹",

  /* Shop details (SAMPLE / FICTIONAL - replace for a real shop) */
  storeName: "Sharma Kirana Store (Demo)",
  storeLocation: "Demo Colony, Sample City (fictional address)",

  /* WhatsApp number for receiving orders.
     PLACEHOLDER - replace with the real shop number, digits only,
     with country code, e.g. 91 followed by the 10-digit number. */
  whatsappNumber: "91XXXXXXXXXX",

  /* Delivery information (sample values, in INR) */
  deliveryFee: 20,
  freeDeliveryAbove: 500,
  deliveryNote: "Home delivery within 2 km (sample terms - shop owner to confirm).",
  pickupNote: "Collect your order from the shop counter.",

  /* Inventory */
  lowStockThreshold: 5,

  /* "en" or "hi" - language used on a visitor's first visit */
  defaultLanguage: "en"
};
