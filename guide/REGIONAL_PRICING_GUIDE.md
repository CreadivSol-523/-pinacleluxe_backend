# Frontend Implementation Guide: Regional Pricing Feature

This guide provides frontend developers with all the necessary details to integrate the **Regional Pricing** feature into the Pinacle Luxe web frontend.

---

## 1. Overview of the Feature
Products can now store different prices per region (e.g., Product A priced at 500 PKR in Pakistan and 50 GBP in the UK). When fetching products (`GET /api/product` or `GET /api/product/:id`), the backend returns a populated `pricing` array mapping each region to its respective price and currency.

---

## 2. API Responses & Payload Structure

### Get Single Product / Product List (with Populated Regional Pricing)
- **URL:** `GET /api/product/:id` or `GET /api/product`
- **Response Format:**
```json
{
  "success": true,
  "product": {
    "_id": "64a7b2c1e4b0a1b2c3d4e5f6",
    "name": "Product A",
    "slug": "product-a",
    "price": 500, // Default / Fallback price
    "pricing": [
      {
        "region": {
          "_id": "pakistan_region_id",
          "name": "Pakistan",
          "code": "PK",
          "currency": "PKR"
        },
        "price": 500,
        "comparePrice": 600,
        "_id": "pricing_id_1"
      },
      {
        "region": {
          "_id": "uk_region_id",
          "name": "United Kingdom",
          "code": "GB",
          "currency": "GBP"
        },
        "price": 50,
        "comparePrice": 65,
        "_id": "pricing_id_2"
      }
    ]
  }
}
```

---

## 3. Payload Structure for Admin Create / Update

When sending a request from the admin dashboard to create or update a product with regional prices, include the `pricing` array (either as JSON or FormData stringified):

### Using `FormData` (Multipart):
```javascript
const formData = new FormData();
formData.append("name", "Product A");
formData.append("price", "500"); // default base price
formData.append("stock", "10");
formData.append("category", categoryId);

// Pass array of regional prices as a JSON string
formData.append("pricing", JSON.stringify([
  { region: "pakistan_region_id", price: 500 },
  { region: "uk_region_id", price: 50 }
]));

// Append images...
```

---

## 4. Frontend Price Resolution Helper

On the storefront, resolve the active price dynamically based on the user's selected region (stored in Redux / Zustand state):

```javascript
export const resolveProductPrice = (product, activeRegionId) => {
    if (!product.pricing || product.pricing.length === 0) {
        return product.price; // Fallback to base price
    }

    const regionalPriceObj = product.pricing.find(
        (p) => (p.region?._id || p.region) === activeRegionId
    );

    return regionalPriceObj ? regionalPriceObj.price : product.price;
};
```
