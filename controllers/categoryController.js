import Category from "../models/Category.js";

/* =========================================================
   CREATE
   ========================================================= */
export const createCategory = async (req, res) => {
  try {
    const { name, color, types, icon } = req.body;

    if (!name || !Array.isArray(types) || types.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const exists = await Category.findOne({ name });
    if (exists) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const newCat = await Category.create({ name, color, types, icon });
    res.status(201).json(newCat);
  } catch (err) {
    console.error("❌ Failed to create category:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   READ (ALL)
   ========================================================= */
export const getCategories = async (req, res) => {
  try {
    const { type } = req.query;

    let filter = {};
    // אם נשלח type מסוים – נחפש קטגוריות שמכילות אותו במערך
    if (type) filter = { types: type };

    const cats = await Category.find(filter).sort("name");
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   UPDATE
   ========================================================= */
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Category.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================================================
   DELETE
   ========================================================= */
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
