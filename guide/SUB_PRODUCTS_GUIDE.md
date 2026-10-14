# Frontend Implementation Guide: Sub-Products & Accessories Feature

This guide provides frontend developers with all the necessary details to integrate the **Sub-Products / Accessories** feature into the Pinacle Luxe web frontend.

---

## 1. Overview of the Feature
Administrators can link existing products as **accessories** (sub-products) to a main product from the admin panel without recreating them. When a customer views a product, the backend returns full details of all linked accessories so they can be displayed as add-ons, bundled items, or related options.

---

## 2. API Endpoints

### Get Product Dropdown List (Lightweight for Admin Dropdowns)
- **URL:** `GET /api/product/dropdown-list`
- **Description:** Returns a lightweight list of all active products specifically designed for populating dropdowns or multi-select components in the admin product creation/edit form.
- **Response Format:**
```json
{
  "success": true,
  "count": 5,
  "products": [
    {
      "_id": "64a7b2c1e4b0a1b2c3d4e5f7",
      "name": "Leather Strap",
      "price": 150,
      "sku": "STRAP-02",
      "stock": 25,
      "images": [
        "https://res.cloudinary.com/.../strap1.jpg"
      ]
    }
  ]
}
```

### Get Single Product (with Populated Accessories)
- **URL:** `GET /api/product/:id`
- **Response Format:**
```json
{
  "success": true,
  "product": {
    "_id": "64a7b2c1e4b0a1b2c3d4e5f6",
    "name": "Luxury Timepiece",
    "slug": "luxury-timepiece",
    "description": "Exquisite Swiss-made luxury watch.",
    "price": 1200,
    "comparePrice": 1500,
    "stock": 10,
    "sku": "WATCH-001",
    "category": {
      "_id": "64a7...abc",
      "name": "Watches",
      "slug": "watches"
    },
    "images": [
      "https://res.cloudinary.com/.../watch1.jpg"
    ],
    "isActive": true,
    "accessories": [
      {
        "_id": "64a7b2c1e4b0a1b2c3d4e5f7",
        "name": "Leather Strap",
        "slug": "leather-strap",
        "description": "Genuine calfskin replacement strap.",
        "price": 150,
        "comparePrice": 200,
        "stock": 25,
        "sku": "STRAP-02",
        "images": [
          "https://res.cloudinary.com/.../strap1.jpg"
        ],
        "isActive": true
      }
    ]
  }
}
```

---

## 3. Payload Structure for Admin Create / Update

When sending a request to create or update a product with accessories from the admin dashboard, include the `accessories` field as an array of product IDs.

### Using `FormData` (Multipart):
Since product creation/updates support image uploads via `FormData`, append `accessories` as a JSON string or array of IDs:

```javascript
const formData = new FormData();
formData.append("name", "Luxury Timepiece");
formData.append("price", "1200");
formData.append("stock", "10");
formData.append("category", categoryId);
formData.append("isVariable", "false");

// Pass array of selected accessory product IDs as a JSON string
formData.append("accessories", JSON.stringify(["64a7b2c1e4b0a1b2c3d4e5f7", "64a7b2c1e4b0a1b2c3d4e5f8"]));

// Append images...
```

### Using JSON Payload:
If updating via JSON:
```json
{
  "name": "Luxury Timepiece",
  "price": 1200,
  "stock": 10,
  "category": "64a7...abc",
  "accessories": [
    "64a7b2c1e4b0a1b2c3d4e5f7"
  ]
}
```

---

## 4. Frontend Integration Steps
1. **Fetch Dropdown List**: In the admin product form, call `GET /api/product/dropdown-list` to populate the multi-select dropdown with product titles, prices, and thumbnail images.
2. **Render Accessories on Product Page**: On `[id]/page.tsx` (Product Detail view), iterate over `product.accessories` to display add-on cards with checkboxes or "Add to Cart" buttons.
3. **Cart Integration**: When adding an accessory to the cart alongside the main product, pass the accessory item object with its respective ID, name, price, and image into `useCartStore`.
