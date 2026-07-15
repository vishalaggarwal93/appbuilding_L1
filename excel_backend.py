import io
import csv
import re
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import openpyxl

app = Flask(__name__)
CORS(app)

def normalize_week(w):
    if not w:
        return "Week 1"
    str_val = str(w).strip()
    upper = str_val.upper()
    clean = re.sub(r'[^A-Z0-9]', '', upper)
    
    if clean in ["W1", "1", "WEEK1", "WEEK01"]: return "Week 1"
    if clean in ["W2", "2", "WEEK2", "WEEK02"]: return "Week 2"
    if clean in ["W3", "3", "WEEK3", "WEEK03"]: return "Week 3"
    if clean in ["W4", "4", "WEEK4", "WEEK04"]: return "Week 4"
    if clean in ["W5", "5", "WEEK5", "WEEK05"]: return "Week 5"
    
    if "WEEK 1" in upper or "WEEK01" in upper or upper in ["W1", "WK1", "WK 1"]: return "Week 1"
    if "WEEK 2" in upper or "WEEK02" in upper or upper in ["W2", "WK2", "WK 2"]: return "Week 2"
    if "WEEK 3" in upper or "WEEK03" in upper or upper in ["W3", "WK3", "WK 3"]: return "Week 3"
    if "WEEK 4" in upper or "WEEK04" in upper or upper in ["W4", "WK4", "WK 4"]: return "Week 4"
    if "WEEK 5" in upper or "WEEK05" in upper or upper in ["W5", "WK5", "WK 5"]: return "Week 5"
    
    return str_val

def get_store_id(store_name):
    store_id_map = {
        "Flagship Store NY": "STR-101",
        "Boutique West LA": "STR-102",
        "Metro Express Chicago": "STR-103",
        "Digital Store Online": "STR-104",
        "Hub South Miami": "STR-105",
        "Core North Boston": "STR-106",
    }
    if store_name in store_id_map:
        return store_id_map[store_name]
    h = 0
    for char in store_name:
        h = ord(char) + ((h << 5) - h)
    id_num = abs(h % 1000) + 107
    return f"STR-{id_num}"

def get_store_name(store_id):
    if not store_id:
        return ""
    store_id_clean = str(store_id).strip().upper()
    name_map = {
        "STR-101": "Flagship Store NY",
        "STR-102": "Boutique West LA",
        "STR-103": "Metro Express Chicago",
        "STR-104": "Digital Store Online",
        "STR-105": "Hub South Miami",
        "STR-106": "Core North Boston",
        "ST-001": "Flagship Store NY",
        "ST-002": "Boutique West LA",
        "ST-003": "Metro Express Chicago",
        "ST-004": "Digital Store Online",
        "ST-005": "Hub South Miami",
        "ST-006": "Core North Boston",
        "ST-101": "Flagship Store NY",
        "ST-102": "Boutique West LA",
        "ST-103": "Metro Express Chicago",
        "ST-104": "Digital Store Online",
        "ST-105": "Hub South Miami",
        "ST-106": "Core North Boston",
    }
    return name_map.get(store_id_clean, store_id)

def enrich_record(r, idx):
    # Determine week from date day
    try:
        day = int(r.get("date", "2026-01-01").split("-")[2])
    except:
        day = 1
    
    week_str = "Week 1"
    if day <= 7: week_str = "Week 1"
    elif day <= 14: week_str = "Week 2"
    elif day <= 21: week_str = "Week 3"
    elif day <= 28: week_str = "Week 4"
    else: week_str = "Week 5"
    
    store_names = ["Flagship Store NY", "Boutique West LA", "Metro Express Chicago", "Digital Store Online", "Hub South Miami", "Core North Boston"]
    cities = ["New York", "Los Angeles", "Chicago", "Seattle", "Miami", "Boston"]
    formats = ["Flagship", "Boutique", "Express", "Online"]
    
    store_idx = idx % len(store_names)
    store = r.get("store") or store_names[store_idx]
    store = get_store_name(store)
    
    city = r.get("city") or cities[store_idx]
    store_format = r.get("storeFormat") or formats[idx % len(formats)]
    store_id = r.get("storeId") or get_store_id(store)
    
    # Return amount
    sales = float(r.get("sales", 0))
    category = r.get("category", "General")
    
    return_pct = 0
    if category == "Apparel":
        return_pct = 0.22 if idx % 3 == 0 else 0.04
    elif category == "Electronics":
        return_pct = 0.12 if idx % 5 == 0 else 0
    else:
        return_pct = 0.08 if idx % 7 == 0 else 0
        
    ret_val = r.get("returnAmount")
    return_amount = round(sales * return_pct, 1) if ret_val is None else float(ret_val)
    
    # Discount amount
    discount_rate = 0.18 if idx % 4 == 0 else (0.08 if idx % 3 == 0 else (0.05 if idx % 5 == 0 else 0))
    disc_val = r.get("discountAmount")
    discount_amount = round(sales * discount_rate, 1) if disc_val is None else float(disc_val)
    
    # Target Sales
    multiplier = 0.85 + ((idx * 7) % 35) / 100.0
    tgt_val = r.get("targetSales")
    target_sales = round(sales * multiplier) if tgt_val is None else float(tgt_val)
    
    # Stock level
    stk_val = r.get("stockLevel")
    stock_level = int(stk_val) if (stk_val is not None and str(stk_val).strip() != "") else (idx * 23) % 95
    
    return {
        "id": str(r.get("id")) if r.get("id") else f"uploaded-{idx}-{int(datetime.datetime.now().timestamp())}",
        "date": r.get("date") or "2026-01-01",
        "category": category,
        "product": r.get("product") or "Product",
        "sales": sales,
        "quantity": int(r.get("quantity", 1)),
        "profit": float(r.get("profit", 0)),
        "region": r.get("region") or "East",
        "segment": r.get("segment") or "Consumer",
        "returnAmount": return_amount,
        "discountAmount": discount_amount,
        "targetSales": target_sales,
        "store": store,
        "storeId": store_id,
        "city": city,
        "storeFormat": store_format,
        "week": normalize_week(r.get("week") or week_str),
        "stockLevel": stock_level
    }

def parse_excel_or_csv_to_records(file_bytes, filename):
    records = []
    rows = []
    
    if filename.endswith(".csv"):
        text = file_bytes.decode('utf-8', errors='ignore')
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
    else:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = wb.active
        for r_tuple in sheet.iter_rows(values_only=True):
            formatted_row = []
            for cell in r_tuple:
                if isinstance(cell, (datetime.datetime, datetime.date)):
                    formatted_row.append(cell.isoformat())
                else:
                    formatted_row.append(cell)
            rows.append(formatted_row)
            
    if not rows or len(rows) < 2:
        return []
        
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    data_rows = rows[1:]
    
    def clean_header(h):
        return re.sub(r'[^a-z0-9]', '', h.lower())
        
    def match_header(includes, excludes=[]):
        for idx, h in enumerate(headers):
            ch = clean_header(h)
            has_include = any(inc in ch for inc in includes)
            has_exclude = any(exc in ch for exc in excludes)
            if has_include and not has_exclude:
                return idx
        return None

    date_idx = match_header(["date", "time", "day", "orderdate", "transdate"], ["update", "birth"])
    category_idx = match_header(["category", "dept", "department", "group"])
    product_idx = match_header(["product", "item", "sku", "desc", "description", "name"], ["store", "customer", "client", "brand", "vendor", "buyer", "user", "city", "format", "region"])
    sales_idx = match_header(["sales", "revenue", "amount", "total", "price", "sale"], ["target", "goal", "budget", "forecast", "return", "refund", "discount", "markdown", "profit", "margin", "cost", "tax", "qty", "quantity", "id"])
    qty_idx = match_header(["qty", "quantity", "units", "count", "volume"], ["price", "amount", "sales", "id"])
    profit_idx = match_header(["profit", "margin", "earnings", "net", "income"], ["gross", "sales", "revenue", "target"])
    region_idx = match_header(["region", "zone", "state", "country"], ["city", "store", "format", "town"])
    segment_idx = match_header(["segment", "customer", "type", "audience", "channel"])
    return_idx = match_header(["returnamount", "return", "returns", "refund", "refunds"], ["rate", "pct", "percent"])
    discount_idx = match_header(["discountamount", "discount", "markdown", "discounts", "markdowns"], ["rate", "pct", "percent"])
    target_idx = match_header(["targetsales", "target", "targets", "goal", "goals", "budget"], ["achievement", "rate", "pct", "percent"])
    store_idx = match_header(["store", "storename", "outlet", "outletname"], ["id", "code", "num", "no", "key", "format", "city", "region"])
    storeid_idx = match_header(["storeid", "storecode", "storenum", "outletid", "storeno"])
    city_idx = match_header(["city", "town", "citylocation"])
    format_idx = match_header(["storeformat", "format"])
    week_idx = match_header(["week", "wk", "weekly"], ["orderdate", "transdate", "salesdate"])
    stock_idx = match_header(["stocklevel", "inventory", "stock", "qtyonhand"], ["sold", "out", "risk"])

    for index, r in enumerate(data_rows):
        if not any(cell is not None and str(cell).strip() != "" for cell in r):
            continue
            
        def get_val(idx, default_val=None):
            if idx is not None and idx < len(r) and r[idx] is not None:
                return r[idx]
            return default_val

        # Product Filter for "Product Item" or "Product"
        product = str(get_val(product_idx, "Product Item")).strip()
        if not product or product.lower() in ["product item", "product"]:
            continue

        raw_date = get_val(date_idx, "2026-01-01")
        date_str = "2026-01-01"
        if isinstance(raw_date, (datetime.datetime, datetime.date)):
            date_str = raw_date.strftime("%Y-%m-%d")
        elif isinstance(raw_date, (int, float)):
            try:
                base_date = datetime.date(1899, 12, 30)
                date_str = (base_date + datetime.timedelta(days=int(raw_date))).strftime("%Y-%m-%d")
            except:
                date_str = "2026-01-01"
        elif raw_date:
            raw_date_str = str(raw_date).strip()
            # Handle date format conversions (like T00:00:00)
            if "T" in raw_date_str:
                raw_date_str = raw_date_str.split("T")[0]
            date_str = raw_date_str
            for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
                try:
                    date_str = datetime.datetime.strptime(raw_date_str, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    continue

        category = str(get_val(category_idx, "General"))

        raw_sales = get_val(sales_idx, 0)
        try:
            if isinstance(raw_sales, (int, float)):
                sales = float(raw_sales)
            else:
                sales = float(re.sub(r'[^0-9.-]', '', str(raw_sales)))
        except:
            sales = 0.0

        raw_qty = get_val(qty_idx, 1)
        try:
            if isinstance(raw_qty, (int, float)):
                quantity = int(raw_qty)
            else:
                quantity = int(re.sub(r'[^0-9-]', '', str(raw_qty)))
        except:
            quantity = 1

        raw_profit = get_val(profit_idx, None)
        profit = None
        if raw_profit is not None:
            try:
                if isinstance(raw_profit, (int, float)):
                    profit = float(raw_profit)
                else:
                    profit = float(re.sub(r'[^0-9.-]', '', str(raw_profit)))
                if 0.0 < profit < 1.0:
                    profit = sales * profit
            except:
                profit = sales * 0.35
        else:
            profit = sales * 0.35

        region = str(get_val(region_idx, "East"))
        segment = str(get_val(segment_idx, "Consumer"))

        return_amount = get_val(return_idx, None)
        discount_amount = get_val(discount_idx, None)
        target_sales = get_val(target_idx, None)
        store = get_val(store_idx, None)
        store_id = get_val(storeid_idx, None)
        city = get_val(city_idx, None)
        store_format = get_val(format_idx, None)
        stock_level = get_val(stock_idx, None)

        raw_week = get_val(week_idx, None)
        week = None
        if raw_week is not None:
            if isinstance(raw_week, (int, float)) and raw_week > 100:
                try:
                    base_date = datetime.date(1899, 12, 30)
                    dt = base_date + datetime.timedelta(days=int(raw_week))
                    week = dt.strftime("%d-%m-%Y")
                except:
                    week = str(raw_week)
            elif isinstance(raw_week, (datetime.datetime, datetime.date)):
                week = raw_week.strftime("%d-%m-%Y")
            else:
                week = str(raw_week).strip()

        raw_data = {
            "id": f"uploaded-{index}-{int(datetime.datetime.now().timestamp())}",
            "date": date_str,
            "category": category,
            "product": product,
            "sales": sales,
            "quantity": quantity,
            "profit": profit,
            "region": region,
            "segment": segment,
            "returnAmount": return_amount,
            "discountAmount": discount_amount,
            "targetSales": target_sales,
            "store": store,
            "storeId": store_id,
            "city": city,
            "storeFormat": store_format,
            "week": week,
            "stockLevel": stock_level
        }
        records.append(enrich_record(raw_data, index))
        
    return records

# Default Seed data matching RAW_SALES_DATA of our App to populate immediately
RAW_SEEDS = [
    { "id": "1", "date": "2026-01-05", "category": "Electronics", "product": "Wireless Headphones", "sales": 1200, "quantity": 8, "profit": 480, "region": "East", "segment": "Consumer" },
    { "id": "2", "date": "2026-01-08", "category": "Apparel", "product": "Running Shoes", "sales": 850, "quantity": 10, "profit": 340, "region": "West", "segment": "Consumer" },
    { "id": "3", "date": "2026-01-12", "category": "Home & Kitchen", "product": "Coffee Maker", "sales": 1500, "quantity": 15, "profit": 450, "region": "North", "segment": "Corporate" },
    { "id": "4", "date": "2026-01-15", "category": "Beauty & Personal Care", "product": "Electric Toothbrush", "sales": 450, "quantity": 5, "profit": 180, "region": "South", "segment": "Home Office" },
    { "id": "5", "date": "2026-01-18", "category": "Electronics", "product": "Smart Watch", "sales": 2400, "quantity": 12, "profit": 960, "region": "West", "segment": "Corporate" },
    { "id": "6", "date": "2026-01-22", "category": "Apparel", "product": "Denim Jacket", "sales": 650, "quantity": 5, "profit": 260, "region": "East", "segment": "Consumer" },
    { "id": "7", "date": "2026-01-25", "category": "Home & Kitchen", "product": "Air Fryer", "sales": 1800, "quantity": 12, "profit": 540, "region": "South", "segment": "Consumer" },
    { "id": "8", "date": "2026-01-29", "category": "Beauty & Personal Care", "product": "Face Serum", "sales": 320, "quantity": 8, "profit": 160, "region": "North", "segment": "Corporate" },
    { "id": "9", "date": "2026-02-02", "category": "Electronics", "product": "Bluetooth Speaker", "sales": 750, "quantity": 10, "profit": 300, "region": "East", "segment": "Consumer" },
    { "id": "10", "date": "2026-02-05", "category": "Apparel", "product": "Wool Scarf", "sales": 240, "quantity": 12, "profit": 96, "region": "North", "segment": "Home Office" },
    { "id": "11", "date": "2026-02-10", "category": "Home & Kitchen", "product": "Blender", "sales": 1100, "quantity": 11, "profit": 330, "region": "West", "segment": "Corporate" },
    { "id": "12", "date": "2026-02-14", "category": "Beauty & Personal Care", "product": "Hair Dryer", "sales": 950, "quantity": 10, "profit": 380, "region": "South", "segment": "Consumer" },
    { "id": "13", "date": "2026-02-18", "category": "Electronics", "product": "Wireless Headphones", "sales": 1500, "quantity": 10, "profit": 600, "region": "West", "segment": "Consumer" },
    { "id": "14", "date": "2026-02-21", "category": "Apparel", "product": "Running Shoes", "sales": 1105, "quantity": 13, "profit": 442, "region": "South", "segment": "Corporate" },
    { "id": "15", "date": "2026-02-25", "category": "Home & Kitchen", "product": "Chef Knife Set", "sales": 1350, "quantity": 9, "profit": 405, "region": "East", "segment": "Home Office" },
    { "id": "16", "date": "2026-02-28", "category": "Beauty & Personal Care", "product": "Beard Trimmer", "sales": 520, "quantity": 8, "profit": 208, "region": "North", "segment": "Consumer" },
    { "id": "17", "date": "2026-03-03", "category": "Electronics", "product": "Smart Watch", "sales": 3000, "quantity": 15, "profit": 1200, "region": "North", "segment": "Consumer" },
    { "id": "18", "date": "2026-03-07", "category": "Apparel", "product": "Athletic Tee", "sales": 480, "quantity": 16, "profit": 192, "region": "East", "segment": "Corporate" },
    { "id": "19", "date": "2026-03-12", "category": "Home & Kitchen", "product": "Coffee Maker", "sales": 1800, "quantity": 18, "profit": 540, "region": "West", "segment": "Consumer" },
    { "id": "20", "date": "2026-03-16", "category": "Beauty & Personal Care", "product": "Electric Toothbrush", "sales": 720, "quantity": 8, "profit": 288, "region": "South", "segment": "Consumer" }
]

@app.route("/api/python/initial-data", methods=["GET"])
def initial_data():
    enriched = [enrich_record(r, idx) for idx, r in enumerate(RAW_SEEDS)]
    return jsonify({
        "status": "success",
        "records": enriched
    })

@app.route("/api/python/parse", methods=["POST"])
def parse_excel():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
        
    try:
        file_bytes = file.read()
        records = parse_excel_or_csv_to_records(file_bytes, file.filename)
        return jsonify({
            "status": "success",
            "filename": file.filename,
            "records": records
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
