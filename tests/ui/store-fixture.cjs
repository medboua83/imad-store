// Read-only isolated store API for SSR and browser regression tests. No external services.
const { createServer } = require("node:http");
const { defaultSiteContent } = require("../../packages/shared/dist");
const category = {
  id: "111111111111111111111111",
  slug: "mens-clogs",
  nameAr: "صابو رجالي",
  nameFr: "Sabots",
  nameEn: "Clogs",
  publishedCount: 1,
};
const variant = (id, color, size, stock) => ({
  id,
  productId: "222222222222222222222222",
  sku: id,
  color: color === "أسود" ? "#000000" : "#804000",
  colorNameAr: color,
  colorNameFr: color,
  colorNameEn: color,
  size,
  stock,
});
const product = {
  id: "222222222222222222222222",
  slug: "fixture-sabot",
  nameAr: "صابو تجريبي",
  nameFr: "Sabot fictif",
  nameEn: "Fixture clog",
  descriptionAr: "",
  descriptionFr: "",
  descriptionEn: "",
  category,
  price: 230,
  freeShipping: true,
  status: "ACTIVE",
  images: ["/images/catalogue-test/sac.webp"],
  variants: [
    variant("333333333333333333333330", "أسود", "40", 2),
    variant("333333333333333333333331", "أسود", "44", 0),
    variant("333333333333333333333332", "بني", "40", 0),
    variant("333333333333333333333333", "بني", "44", 3),
    variant("333333333333333333333334", "أسود", "40 41 42 43 44", 9),
  ],
};
const recommended = (id, slug, nameAr, price) => ({ ...product, id, slug, nameAr, nameFr: nameAr, nameEn: nameAr, price,
  variants: [ { ...variant(id.slice(0,23)+"1", "أسود", "M", 6), productId:id } ] });
const premium = recommended("444444444444444444444444", "fixture-premium", "موديل للمقارنة", 300);
const accessory = recommended("555555555555555555555555", "fixture-accessory", "قطعة مكملة تجريبية", 50);
const secondSource = recommended("666666666666666666666666", "fixture-second-source", "منتج ثان تجريبي", 80);
createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.writeHead(405);
    return res.end("{}");
  }
  const pathname = new URL(req.url, "http://127.0.0.1").pathname;
  let data;
  if (pathname === "/api/settings")
    data = { shippingCost: 45, freeShippingMin: 500, codEnabled: true, metaPixelEnabled: false };
  else if (pathname === "/api/content") data = defaultSiteContent;
  else if (pathname === "/api/categories") data = [category, {...category, id:"111111111111111111111112", slug:"empty-category", nameAr:"مجموعة فارغة", nameFr:"Collection vide", publishedCount:0}];
  else if (pathname === "/api/products")
    return res.end(
      JSON.stringify({ success: true, data: [product], total: 1, totalPages: 1, page: 1 }),
    );
  else if (pathname === "/api/products/fixture-recommendations") data = {...product, slug:"fixture-recommendations"};
  else if (pathname === "/api/products/fixture-premium") data = premium;
  else if (pathname === "/api/products/fixture-accessory") data = accessory;
  else if (pathname === "/api/products/fixture-second-source") data = secondSource;
  else if (pathname === "/api/products/fixture-recommendations/recommendations") data = {upsell:[premium],crossSell:[accessory]};
  else if (pathname === "/api/products/fixture-second-source/recommendations") data = {upsell:[],crossSell:[accessory,premium,product]};
  else if (pathname.endsWith("/recommendations")) data = {upsell:[],crossSell:[]};
  else if (pathname === "/api/products/fixture-sabot") data = product;
  else if (pathname === "/api/products/fixture-offer") data = {
    ...product, slug: "fixture-offer", quantityDiscounts: [{minQuantity:2,unitPrice:200},{minQuantity:3,unitPrice:180}],
  };
  else if (pathname === "/api/products/fixture-pack") data = {
    ...product, slug: "fixture-pack", quantityDiscounts: [{minQuantity:3,unitPrice:500/3,totalPrice:500}],
  };
  else if (pathname === "/api/products/fixture-manual") data = {
    ...product, slug: "fixture-manual", quantityDiscounts: [{minQuantity:2,unitPrice:200,totalPrice:400}],
  };
  else if (pathname === "/api/products/fixture-override") data = {
    ...product, slug: "fixture-override", quantityDiscounts: [{minQuantity:2,unitPrice:200,totalPrice:400},{minQuantity:3,unitPrice:650/3,totalPrice:650}],
  };
  else {
    res.writeHead(404);
    return res.end("{}");
  }
  res.end(JSON.stringify({ success: true, data }));
}).listen(4000, "127.0.0.1");
