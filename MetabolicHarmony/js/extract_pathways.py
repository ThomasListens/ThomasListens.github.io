import json

JS_FILE = "pathways.js"
OUT_FILE = "pathway_id_category_subcategory.tsv"

with open(JS_FILE, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find start and end of ALL_PATHWAYS_RAW
start = None
end = None

for i, line in enumerate(lines):
    if "const ALL_PATHWAYS_RAW" in line:
        start = i
    if start is not None and line.strip() == "];":
        end = i
        break

if start is None or end is None:
    raise RuntimeError("Could not locate ALL_PATHWAYS_RAW block")

# Join the array text
array_lines = lines[start:end+1]
array_text = "".join(array_lines)

# Remove JS variable declaration
array_text = array_text.split("=", 1)[1].strip().rstrip(";")

# Convert JS → JSON safely
array_text = array_text.replace("'", '"')

# Remove trailing commas before } or ]
while ",}" in array_text or ",]" in array_text:
    array_text = array_text.replace(",}", "}").replace(",]", "]")

# Parse
data = json.loads(array_text)

# Write minimal output
with open(OUT_FILE, "w", encoding="utf-8") as out:
    out.write("id\tcategory\tsubcategory\n")
    for p in data:
        out.write(f"{p['id']}\t{p['category']}\t{p['subcategory']}\n")

print(f"✅ Wrote {len(data)} rows to {OUT_FILE}")