import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "../../Styling/settings.css";

const getToken = () => {
  const raw = localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

// Helper function to safely parse JSON responses
const safeParseJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("JSON parse error:", error);
    return null;
  }
};

const Settings = () => {
  // Business and UI states
  const [selectedCategory, setSelectedCategory] = useState("Business Info");
  const [userBusinesses, setUserBusinesses] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  // Products state
  const [products, setProducts] = useState([]);

  // Updated Product state with new fields (aligned with ClothingItemDTO)
  const [newProduct, setNewProduct] = useState({
    description: "",
    price: "",
    quantity: "",
    category: "",
    brand: "",
    model: "",
    pictureUrls: "",
    colors: "",
    sizes: "",
    customSize: "",
    material: ""
  });
  const [editingProductId, setEditingProductId] = useState(null);

  // Category states
  const [newCategory, setNewCategory] = useState({ name: "", color: "#000000" });
  const [categories, setCategories] = useState([]);

  // Other states
  const [employees, setEmployees] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New states for profile and cover photo file uploads
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);

  const navigate = useNavigate();

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const handleSelectBusiness = (businessId) => {
    const business = userBusinesses.find((b) => b.businessId === businessId);
    if (business) fetchBusinessDetails(business.businessId);
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      const res = await fetch("https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business", {
        headers: getHeaders(),
      });
      const data = (await safeParseJson(res)) || [];
      setUserBusinesses(data);
      if (data.length > 0) fetchBusinessDetails(data[0].businessId);
      setIsLoading(false);
    };
    fetchBusinesses();
  }, []);

  const fetchBusinessDetails = async (businessId) => {
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/${businessId}`,
      { headers: getHeaders() }
    );
    const data = (await safeParseJson(res)) || {};
    setSelectedBusiness(data);
    setFormData({ name: data.name, description: data.description });
    fetchProducts(businessId);
    fetchCategories(businessId);
    fetchEmployees(businessId);
    fetchPendingChanges();
  };

  const fetchProducts = async (businessId) => {
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem/business/${businessId}`,
      { headers: getHeaders() }
    );
    const data = (await safeParseJson(res)) || [];
    setProducts(data);
  };

  const fetchCategories = async (businessId) => {
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Category/business/${businessId}`,
      { headers: getHeaders() }
    );
    const data = (await safeParseJson(res)) || [];
    setCategories(data);
  };

  const fetchEmployees = async (businessId) => {
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Employee/business/${businessId}`,
      { headers: getHeaders() }
    );
    const data = (await safeParseJson(res)) || [];
    setEmployees(data);
  };

  const fetchPendingChanges = async () => {
    const res = await fetch("https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ProposedChange", {
      headers: getHeaders(),
    });
    const data = (await safeParseJson(res)) || [];
    setPendingChanges(data);
  };

  const saveBusinessInfo = async () => {
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/${selectedBusiness.businessId}`,
      {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ ...selectedBusiness, ...formData }),
      }
    );
    alert(res.ok ? "Business info updated!" : "Failed to update business.");
  };

  // Updated saveProduct: builds payload according to ClothingItemDTO.
  // If "Other" is selected for size, it uses the custom size value.
  const saveProduct = async () => {
    const method = editingProductId ? "PUT" : "POST";
    const url = editingProductId
      ? `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem/item/${editingProductId}`
      : "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem";
    
    const sizeValue = newProduct.sizes === "Other" ? newProduct.customSize : newProduct.sizes;

    const body = {
      BusinessIds: [selectedBusiness.businessId],
      Description: newProduct.description,
      Price: parseFloat(newProduct.price),
      Quantity: parseInt(newProduct.quantity),
      Category: newProduct.category,
      Brand: newProduct.brand,
      Model: newProduct.model,
      PictureUrls: newProduct.pictureUrls ? [newProduct.pictureUrls] : [],
      Colors: newProduct.colors,
      Sizes: sizeValue,
      Material: newProduct.material,
    };

    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    alert(res.ok ? "Product saved!" : "Failed to save product.");
    // Reset product state
    setNewProduct({
      description: "",
      price: "",
      quantity: "",
      category: "",
      brand: "",
      model: "",
      pictureUrls: "",
      colors: "",
      sizes: "",
      customSize: "",
      material: ""
    });
    setEditingProductId(null);
    fetchProducts(selectedBusiness.businessId);
  };

  // New function: Save profile and cover photos using file upload (FormData)
  const saveProfileCoverPhotos = async () => {
    if (!profilePhoto && !coverPhoto) {
      alert("Please select at least one image to update.");
      return;
    }
    const formData = new FormData();
    if (profilePhoto) {
      formData.append("profilePhoto", profilePhoto);
    }
    if (coverPhoto) {
      formData.append("coverPhoto", coverPhoto);
    }
    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/${selectedBusiness.businessId}/profile`,
      {
        method: "PUT",
        // Do not set "Content-Type" header when using FormData
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      }
    );
    alert(res.ok ? "Profile updated!" : "Failed to update profile.");
  };

  const deleteProduct = async (clothingItemId) => {
    await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem/item/${clothingItemId}`,
      { method: "DELETE", headers: getHeaders() }
    );
    fetchProducts(selectedBusiness.businessId);
  };

  const saveCategory = async () => {
    const res = await fetch("https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Category", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        name: newCategory.name,
        color: newCategory.color,
        businessId: selectedBusiness.businessId,
      }),
    });
    alert(res.ok ? "Category added!" : "Failed to add category.");
    setNewCategory({ name: "", color: "#000000" });
    fetchCategories(selectedBusiness.businessId);
  };

  const sidebarItems = [
    "Business Info",
    "Add New Products/Categories",
    "Edit Current Products",
    "Product Categories",
    "Edit Profile/Cover Photo",
    "Employee Management",
    "Pending Changes",
    "Shop Preview",
  ];

  const renderContent = () => {
    if (!selectedBusiness) return <p>Please select a business to manage.</p>;

    switch (selectedCategory) {
      case "Business Info":
        return (
          <div className="panel">
            <h3>Edit Business Info</h3>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <button onClick={saveBusinessInfo}>Save</button>
          </div>
        );
      case "Add New Products/Categories":
        return (
          <div className="dual-panel">
            <div className="panel">
              <h3>Add Product</h3>
              <input
                placeholder="Brand"
                value={newProduct.brand}
                onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
              />
              <input
                placeholder="Model"
                value={newProduct.model}
                onChange={(e) => setNewProduct({ ...newProduct, model: e.target.value })}
              />
              <textarea
                placeholder="Description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
              <input
                type="number"
                placeholder="Price"
                value={newProduct.price}
                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              />
              <input
                type="number"
                placeholder="Quantity"
                value={newProduct.quantity}
                onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
              />
              <input
                placeholder="Category (optional)"
                value={newProduct.category}
                onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
              />
              <input
                placeholder="Picture URL"
                value={newProduct.pictureUrls}
                onChange={(e) => setNewProduct({ ...newProduct, pictureUrls: e.target.value })}
              />
              <input
                placeholder="Colors"
                value={newProduct.colors}
                onChange={(e) => setNewProduct({ ...newProduct, colors: e.target.value })}
              />
              <select
                value={newProduct.sizes}
                onChange={(e) => setNewProduct({ ...newProduct, sizes: e.target.value })}
              >
                <option value="" disabled>
                  Select Size
                </option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
                <option value="Other">Other</option>
              </select>
              {newProduct.sizes === "Other" && (
                <input
                  placeholder="Custom Size"
                  value={newProduct.customSize}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, customSize: e.target.value })
                  }
                />
              )}
              <input
                placeholder="Material"
                value={newProduct.material}
                onChange={(e) => setNewProduct({ ...newProduct, material: e.target.value })}
              />
              <button onClick={saveProduct}>Save Product</button>
            </div>
            <div className="panel">
              <h3>Add Category</h3>
              <input
                placeholder="Category Name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              />
              <button onClick={saveCategory}>Add Category</button>
            </div>
          </div>
        );
      case "Edit Current Products":
        return (
          <div className="panel">
            <h3>Products</h3>
            <ul className="product-list">
              {products.map((p) => (
                <li key={p.ClothingItemId}>
                  <span>
                    {p.Brand} - {p.Model} (${p.Price})
                  </span>
                  <button
                    onClick={() => {
                      setNewProduct(p);
                      setEditingProductId(p.ClothingItemId);
                    }}
                  >
                    Edit
                  </button>
                  <button onClick={() => deleteProduct(p.ClothingItemId)}>Delete</button>
                </li>
              ))}
            </ul>
          </div>
        );
      case "Product Categories":
        return (
          <div className="panel">
            <h3>Categories</h3>
            <ul>
              {categories.map((cat) => (
                <li key={cat.id}>{cat.name}</li>
              ))}
            </ul>
          </div>
        );
      case "Edit Profile/Cover Photo":
        return (
          <div className="panel">
            <h3>Edit Profile/Cover Photo</h3>
            <label>Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfilePhoto(e.target.files[0])}
            />
            <label>Cover Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverPhoto(e.target.files[0])}
            />
            <button onClick={saveProfileCoverPhotos}>Update Photos</button>
          </div>
        );
      case "Employee Management":
        return (
          <div className="panel">
            <h3>Employees</h3>
            <ul>
              {employees.map((emp) => (
                <li key={emp.id}>
                  {emp.name} ({emp.email})
                </li>
              ))}
            </ul>
          </div>
        );
      case "Pending Changes":
        return (
          <div className="panel">
            <h3>Pending Changes</h3>
            <ul>
              {pendingChanges.map((change) => (
                <li key={change.id}>
                  <strong>{change.type}</strong>: {change.description} —{" "}
                  <em>Status: {change.status}</em>
                </li>
              ))}
            </ul>
          </div>
        );
      case "Shop Preview":
        return (
          <div className="panel">
            {selectedBusiness.slug ? (
              <iframe
                src={`${window.location.origin}/shops/${selectedBusiness.slug}`}
                title="Shop Preview"
                width="100%"
                height="600px"
                style={{ border: "none" }}
              ></iframe>
            ) : (
              <p>Shop preview unavailable. Please update your business shop settings.</p>
            )}
          </div>
        );
      default:
        return <p>Invalid section.</p>;
    }
  };

  return (
    <div className="settings-component">
      <div className="settings-layout">
        <Navbar />
        <div className="settings-wrapper">
          <div className="settings-sidebar">
            <select
              value={selectedBusiness?.businessId || ""}
              onChange={(e) => handleSelectBusiness(parseInt(e.target.value))}
            >
              <option value="" disabled>
                -- Choose Business --
              </option>
              {userBusinesses.map((b) => (
                <option key={b.businessId} value={b.businessId}>
                  {b.name}
                </option>
              ))}
            </select>
            <ul>
              {sidebarItems.map((item) => (
                <li
                  key={item}
                  onClick={() => setSelectedCategory(item)}
                  className={selectedCategory === item ? "active" : ""}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="settings-content">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
