# Sahil Optical — Backend API Documentation

Base URL: `http://localhost:5000/api`

All responses follow a standard envelope:
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Success message",
  "data": {}
}
```

Protected endpoints require a JWT token passed either in the `Authorization` header:
```
Authorization: Bearer <JWT_TOKEN>
```
or via the `token` HTTP-only cookie set on login.

---

## 1. Authentication (`/api/auth`)

### 1.1 Login
- **Endpoint:** `POST /api/auth/login`
- **Access:** Public
- **Default Seeded Admin:** `username: "admin"`, `password: "password123"`

**Example Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "673ca120f8b41c2d88e9a001",
      "name": "Sahil Optical Admin",
      "username": "admin",
      "role": "admin",
      "createdAt": "2026-11-19T15:15:00.000Z"
    }
  }
}
```

### 1.2 Get Current User
- **Endpoint:** `GET /api/auth/me`
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Current user fetched successfully",
  "data": {
    "_id": "673ca120f8b41c2d88e9a001",
    "name": "Sahil Optical Admin",
    "username": "admin",
    "role": "admin",
    "createdAt": "2026-11-19T15:15:00.000Z",
    "updatedAt": "2026-11-19T15:15:00.000Z"
  }
}
```

### 1.3 Logout
- **Endpoint:** `POST /api/auth/logout`
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

---

## 2. Dashboard (`/api/dashboard`)

### 2.1 Get Dashboard Summary
- **Endpoint:** `GET /api/dashboard` (or `GET /api/dashboard/stats`)
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Dashboard statistics fetched successfully",
  "data": {
    "totalBills": 2,
    "totalSales": 10080,
    "totalCustomers": 2,
    "pendingPayments": 3160,
    "recentBills": [
      {
        "_id": "673ca120f8b41c2d88e9a010",
        "billNumber": "SO-2026-0002",
        "customer": {
          "_id": "673ca120f8b41c2d88e9a006",
          "name": "Priya Deshmukh",
          "mobile": "9811122334",
          "address": "Deccan Gymkhana, Pune"
        },
        "billDate": "2026-11-19T15:20:00.000Z",
        "grandTotal": 3920,
        "advance": 3920,
        "balance": 0,
        "paymentMode": "Cash",
        "paymentStatus": "Paid"
      }
    ],
    "monthlySalesSummary": [
      {
        "year": 2026,
        "month": 11,
        "label": "Nov 2026",
        "totalBills": 2,
        "totalSales": 10080,
        "receivedAmount": 6920,
        "pendingAmount": 3160
      }
    ]
  }
}
```

---

## 3. Shop Settings (`/api/shop` or `/api/settings`)

### 3.1 Get Shop Details
- **Endpoint:** `GET /api/shop`
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Shop details fetched successfully",
  "data": {
    "_id": "673ca120f8b41c2d88e9a002",
    "shopName": "Sahil Optical",
    "address": "Shop No. 12, MG Road, Pune",
    "mobile": "9876543210",
    "email": "info@sahiloptical.com",
    "GSTIN": "27AABCS1429B1Z1",
    "tagline": "Precision Eye Care & Designer Eyewear"
  }
}
```

### 3.2 Update Shop Details
- **Endpoint:** `PUT /api/shop`
- **Access:** Private

**Example Request:**
```json
{
  "shopName": "Sahil Optical",
  "address": "Shop No. 12, MG Road, Pune",
  "mobile": "9876543210",
  "email": "info@sahiloptical.com",
  "GSTIN": "27AABCS1429B1Z1",
  "tagline": "Precision Eye Care & Designer Eyewear"
}
```

---

## 4. Customers (`/api/customers`)

### 4.1 Create Customer (Reuses Existing Customer by Mobile Number)
- **Endpoint:** `POST /api/customers`
- **Access:** Private

**Example Request:**
```json
{
  "name": "Rahul Sharma",
  "mobile": "9822011223",
  "address": "Kothrud, Pune"
}
```

**Example Response (`201 Created` or `200 OK` if mobile reused):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Customer created successfully",
  "data": {
    "_id": "673ca120f8b41c2d88e9a005",
    "name": "Rahul Sharma",
    "mobile": "9822011223",
    "address": "Kothrud, Pune",
    "createdAt": "2026-11-19T15:18:00.000Z"
  }
}
```

### 4.2 Get All / Search Customers (including Mobile Search)
- **Endpoint:** `GET /api/customers?search=Rahul` or `GET /api/customers?mobile=98220`
- **Access:** Private

### 4.2b Lookup Customer by Exact Mobile (Autofill + Latest Prescription)
- **Endpoint:** `GET /api/customers/mobile/:mobile`
- **Access:** Private
- **Description:** Used in Section 1 of Bill Creation to autofill existing customer details and optionally load their latest saved eye prescription.

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Existing customer found for autofill",
  "data": {
    "found": true,
    "customer": {
      "_id": "673ca120f8b41c2d88e9a005",
      "name": "Amit Kulkarni",
      "mobile": "9822011223",
      "address": "Kothrud, Pune"
    },
    "latestPrescription": {
      "rightEye": { "sph": "-1.75", "cyl": "-0.50", "axis": "90", "add": "+1.50", "va": "" },
      "leftEye": { "sph": "-1.50", "cyl": "-0.25", "axis": "85", "add": "+1.50", "va": "" },
      "pdDistance": "63",
      "pdNear": "60",
      "lensType": "Progressive",
      "remarks": "Blue cut anti-glare recommended",
      "fromBillNumber": "SO-2026-0001"
    }
  }
}
```

### 4.3 Update Customer
- **Endpoint:** `PUT /api/customers/:id`
- **Access:** Private

### 4.4 Delete Customer
- **Endpoint:** `DELETE /api/customers/:id`
- **Access:** Private

### 4.5 Customer Billing History
- **Endpoint:** `GET /api/customers/:id/bills` (or `GET /api/customers/:id/history`)
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Customer billing history fetched successfully",
  "data": {
    "customer": {
      "_id": "673ca120f8b41c2d88e9a005",
      "name": "Rahul K. Sharma",
      "mobile": "9822011223",
      "address": "Baner, Pune"
    },
    "summary": {
      "totalBills": 1,
      "totalSpent": 6160,
      "totalPaid": 3000,
      "totalBalance": 3160
    },
    "bills": []
  }
}
```

---

## 5. Products (`/api/products`)

### 5.1 Add Product
- **Endpoint:** `POST /api/products`
- **Access:** Private

**Example Request:**
```json
{
  "name": "Ray-Ban Aviator Metal Frame",
  "category": "Frames",
  "description": "Gold full-rim aviator frame",
  "price": 3500
}
```

**Example Response (`201 Created`):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Product added successfully",
  "data": {
    "_id": "673ca120f8b41c2d88e9a003",
    "name": "Ray-Ban Aviator Metal Frame",
    "category": "Frames",
    "description": "Gold full-rim aviator frame",
    "price": 3500
  }
}
```

### 5.2 Get / Search Products & Supported Categories
- **Endpoint:** `GET /api/products?search=Aviator&category=Frames`
- **Categories Endpoint:** `GET /api/products/categories` -> `["Eyeglasses", "Frames", "Lenses", "Sunglasses", "Contact Lenses", "Accessories", "Other"]`
- **Access:** Private

### 5.3 Update Product
- **Endpoint:** `PUT /api/products/:id`
- **Access:** Private

### 5.4 Delete Product
- **Endpoint:** `DELETE /api/products/:id`
- **Access:** Private

---

## 6. Bills & Complete Invoice Workflow (`/api/bills`)

### 6.0 Backend Calculation Preview
- **Endpoint:** `POST /api/bills/calculate`
- **Access:** Private
- **Description:** Computes item amounts, `subtotal`, fixed/percentage `discount`, `taxableAmount`, `GST` (`cgst` + `sgst`), `grandTotal`, `balance`, and `paymentStatus` on the backend without persisting to MongoDB.

### 6.1 Create Bill (Returns Complete Invoice Details)
- **Endpoint:** `POST /api/bills`
- **Access:** Private
- **Notes:**
  - Auto-generates unique `billNumber` (e.g., `SO-2026-0001`).
  - Saves or updates existing customer by `mobile`.
  - Eye `prescription` (`rightEye` OD, `leftEye` OS, `pdDistance`, `pdNear`, `lensType`) is completely optional.
  - Supports both catalogue products (`product` ID) and manually entered custom items (`isManual: true`) across all 7 categories (`Eyeglasses`, `Frames`, `Lenses`, `Sunglasses`, `Contact Lenses`, `Accessories`, `Other`).
  - Supports `discountType`: `"fixed"` or `"percentage"`.
  - Computes all monetary totals on the backend (`Subtotal`, `Discount`, `Taxable Amount`, `GST`, `Grand Total`, `Balance`, and `paymentStatus`: `Paid` / `Partial` / `Pending`).
  - Returns complete invoice details including `shop` information.

**Example Request:**
```json
{
  "customer": {
    "name": "Amit Kulkarni",
    "mobile": "9822011223",
    "address": "Kothrud, Pune"
  },
  "prescription": {
    "rightEye": { "sph": "-1.75", "cyl": "-0.50", "axis": "90", "add": "+1.50" },
    "leftEye": { "sph": "-1.50", "cyl": "-0.25", "axis": "85", "add": "+1.50" },
    "pdDistance": "63",
    "pdNear": "60",
    "lensType": "Progressive",
    "remarks": "Blue cut anti-glare recommended"
  },
  "items": [
    {
      "product": "673ca120f8b41c2d88e9a003",
      "quantity": 1
    },
    {
      "name": "Custom Anti-Fog Hard Case & Spray",
      "category": "Accessories",
      "quantity": 2,
      "rate": 250
    }
  ],
  "discountType": "percentage",
  "discountValue": 10,
  "gstRate": 12,
  "advance": 2000,
  "paymentMode": "Mixed",
  "paymentBreakdown": { "cash": 500, "upi": 1000, "card": 500 },
  "notes": "Customer requested lens cleaning cloth"
}
```

**Example Response (`201 Created`):**
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Bill created successfully",
  "data": {
    "_id": "673ca120f8b41c2d88e9a009",
    "billNumber": "SO-2026-0001",
    "billDate": "2026-11-19T16:20:00.000Z",
    "shop": {
      "shopName": "Sahil Optical",
      "tagline": "Precision Eye Care & Optical Showroom",
      "address": "Shop 14, FC Road, Pune - 411004",
      "mobile": "9876543210",
      "email": "billing@sahiloptical.com",
      "GSTIN": "27AABCS1429B1Z1"
    },
    "customer": {
      "_id": "673ca120f8b41c2d88e9a005",
      "name": "Amit Kulkarni",
      "mobile": "9822011223",
      "address": "Kothrud, Pune"
    },
    "items": [
      {
        "product": "673ca120f8b41c2d88e9a003",
        "isManual": false,
        "name": "Ray-Ban Clubmaster Frame",
        "category": "Frames",
        "quantity": 1,
        "rate": 3500,
        "price": 3500,
        "amount": 3500
      },
      {
        "product": null,
        "isManual": true,
        "name": "Custom Anti-Fog Hard Case & Spray",
        "category": "Accessories",
        "quantity": 2,
        "rate": 250,
        "price": 250,
        "amount": 500
      }
    ],
    "prescription": {
      "rightEye": { "sph": "-1.75", "cyl": "-0.50", "axis": "90", "add": "+1.50", "va": "" },
      "leftEye": { "sph": "-1.50", "cyl": "-0.25", "axis": "85", "add": "+1.50", "va": "" },
      "pdDistance": "63",
      "pdNear": "60",
      "lensType": "Progressive",
      "remarks": "Blue cut anti-glare recommended"
    },
    "hasPrescription": true,
    "subtotal": 4000,
    "discountType": "percentage",
    "discountValue": 10,
    "discount": 400,
    "taxableAmount": 3600,
    "gstRate": 12,
    "GST": 432,
    "cgst": 216,
    "sgst": 216,
    "grandTotal": 4032,
    "advance": 2000,
    "balance": 2032,
    "paymentMode": "Mixed",
    "paymentBreakdown": { "cash": 500, "upi": 1000, "card": 500 },
    "paymentStatus": "Partial",
    "notes": "Customer requested lens cleaning cloth"
  }
}
```

### 6.2 Get All / Search / Filter Bills by Date
- **Endpoint:** `GET /api/bills?search=SO-2026&startDate=2026-11-01&endDate=2026-11-30&paymentStatus=Partial`
- **Access:** Private

### 6.3 Get Bill / Complete Invoice JSON by ID
- **Endpoint:** `GET /api/bills/:id` or `GET /api/bills/:id/invoice`
- **Access:** Private

### 6.4 Print-Ready HTML Invoice
- **Endpoint:** `GET /api/bills/:id/print`
- **Access:** Private
- **Response:** `text/html` formatted Sahil Optical Tax Invoice with `@media print` CSS and one-click Print button.

### 6.5 Download / View PDF Invoice
- **Endpoint:** `GET /api/bills/:id/pdf` (append `?download=true` for `Content-Disposition: attachment`)
- **Access:** Private
- **Response:** `application/pdf` binary A4 Tax Invoice generated with PDFKit.

### 6.6 Delete Bill
- **Endpoint:** `DELETE /api/bills/:id`
- **Access:** Private

---

## 7. Reports (`/api/reports`)

### 7.1 Get Sales & Financial Reports
- **Endpoint:** `GET /api/reports?startDate=2026-11-01&endDate=2026-11-30`
- **Access:** Private

**Example Response (`200 OK`):**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Reports generated successfully",
  "data": {
    "totalRevenue": 10080,
    "paidAndPendingAmounts": {
      "totalRevenue": 10080,
      "paidAmount": 6920,
      "pendingAmount": 3160,
      "totalDiscount": 500,
      "totalGST": 1080,
      "totalBills": 2
    },
    "dailySales": [
      {
        "date": "2026-11-19",
        "totalBills": 2,
        "totalRevenue": 10080,
        "paidAmount": 6920,
        "pendingAmount": 3160
      }
    ],
    "monthlySales": [
      {
        "month": "2026-11",
        "totalBills": 2,
        "totalRevenue": 10080,
        "paidAmount": 6920,
        "pendingAmount": 3160
      }
    ],
    "paymentModeSummary": [
      {
        "paymentMode": "UPI",
        "count": 1,
        "totalRevenue": 6160,
        "paidAmount": 3000,
        "pendingAmount": 3160
      },
      {
        "paymentMode": "Cash",
        "count": 1,
        "totalRevenue": 3920,
        "paidAmount": 3920,
        "pendingAmount": 0
      }
    ],
    "paymentStatusSummary": [
      {
        "paymentStatus": "Partial",
        "count": 1,
        "totalRevenue": 6160,
        "paidAmount": 3000,
        "pendingAmount": 3160
      },
      {
        "paymentStatus": "Paid",
        "count": 1,
        "totalRevenue": 3920,
        "paidAmount": 3920,
        "pendingAmount": 0
      }
    ]
  }
}
```
