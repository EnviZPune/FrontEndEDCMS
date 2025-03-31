import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar";
import "../../Styling/settings.css";
import { FaSearch } from "react-icons/fa";
import {
  FaBuilding,
  FaBoxOpen,
  FaEdit,
  FaList,
  FaUserEdit,
  FaUsers,
  FaExclamationTriangle,
  FaEye,
  FaTrash,
} from "react-icons/fa";

const getToken = () => {
  const raw =
    localStorage.getItem("token") || localStorage.getItem("authToken");
  if (!raw || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

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
  const [newProduct, setNewProduct] = useState({
    description: "",
    price: "",
    quantity: "",
    category: "",
    brand: "",
    model: "",
    pictureUrls: "",
    colors: "",
    sizes: "XS", // default; valid: XS, S, M, L, XL, XXL
    material: "",
  });
  const [editingProductId, setEditingProductId] = useState(null);

  // Category states
  const [newCategory, setNewCategory] = useState({ name: "", color: "#000000" });
  const [categories, setCategories] = useState([]);

  // Employee management states
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", role: "" });
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Other states
  const [pendingChanges, setPendingChanges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Profile and cover photo uploads
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);

  const navigate = useNavigate();

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  // Mapping for sizes (for saving)
  const sizeMapping = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 };
  // Reverse mapping for inline editing display (if your API returns numeric values)
  const reverseSizeMapping = { 0: "XS", 1: "S", 2: "M", 3: "L", 4: "XL", 5: "XXL" };

  const handleSelectBusiness = (businessId) => {
    const business = userBusinesses.find((b) => b.businessId === businessId);
    if (business) fetchBusinessDetails(business.businessId);
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      const res = await fetch(
        "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business",
        { headers: getHeaders() }
      );
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
    const res = await fetch(
      "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ProposedChange",
      { headers: getHeaders() }
    );
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

  const saveProduct = async () => {
    const method = editingProductId ? "PUT" : "POST";
    const url = editingProductId
      ? `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem/item/${editingProductId}`
      : "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/ClothingItem";

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
      Sizes: sizeMapping[newProduct.sizes],
      Material: newProduct.material,
    };

    try {
      const res = await fetch(url, {
        method,
        mode: "cors",
        headers: getHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error("Failed to save product, status:", res.status);
        alert("Failed to save product.");
      } else {
        alert("Product saved!");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Network error when attempting to save product.");
    }

    // Reset form state and exit edit mode
    setNewProduct({
      description: "",
      price: "",
      quantity: "",
      category: "",
      brand: "",
      model: "",
      pictureUrls: "",
      colors: "",
      sizes: "XS",
      material: "",
    });
    setEditingProductId(null);
    fetchProducts(selectedBusiness.businessId);
  };

  const saveProfileCoverPhotos = async () => {
    if (!profilePhoto && !coverPhoto) {
      alert("Please select at least one image to update.");
      return;
    }
    const formData = new FormData();
    if (profilePhoto) formData.append("profilePhoto", profilePhoto);
    if (coverPhoto) formData.append("coverPhoto", coverPhoto);

    const res = await fetch(
      `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/${selectedBusiness.businessId}/profile`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
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

  const [searchQuery, setSearchQuery] = useState("");

  const deleteBusiness = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this business? This action cannot be undone."
      )
    ) {
      const res = await fetch(
        `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Business/${selectedBusiness.businessId}`,
        { method: "DELETE", headers: getHeaders() }
      );
      if (res.ok) {
        alert("Business deleted successfully.");
        navigate("/dashboard");
      } else {
        alert("Failed to delete business. Error " + res.status);
      }
    }
  };

  // Employee endpoints
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (editingEmployee) {
      const res = await fetch(
        `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Employee/${editingEmployee.id}`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify({
            ...newEmployee,
            businessId: selectedBusiness.businessId,
          }),
        }
      );
      alert(res.ok ? "Employee updated!" : "Failed to update employee.");
      setEditingEmployee(null);
    } else {
      const res = await fetch(
        "https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Employee",
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            ...newEmployee,
            businessId: selectedBusiness.businessId,
          }),
        }
      );
      alert(res.ok ? "Employee added!" : "Failed to add employee.");
    }
    setNewEmployee({ name: "", email: "", role: "" });
    fetchEmployees(selectedBusiness.businessId);
  };

  const handleEditEmployee = (employee) => {
    setEditingEmployee(employee);
    setNewEmployee({
      name: employee.name,
      email: employee.email,
      role: employee.role,
    });
  };

  const deleteEmployee = async (employeeId) => {
    if (window.confirm("Are you sure you want to delete this employee?")) {
      const res = await fetch(
        `https://urchin-app-lpasr-rhik3.ondigitalocean.app/api/Employee/${employeeId}`,
        { method: "DELETE", headers: getHeaders() }
      );
      alert(res.ok ? "Employee deleted!" : "Failed to delete employee.");
      fetchEmployees(selectedBusiness.businessId);
    }
  };

  const sidebarItems = [
    { name: "Business Info", icon: <FaBuilding /> },
    { name: "Add New Products/Categories", icon: <FaBoxOpen /> },
    { name: "Edit Current Products", icon: <FaEdit /> },
    { name: "Product Categories", icon: <FaList /> },
    { name: "Edit Profile/Cover Photo", icon: <FaUserEdit /> },
    { name: "Employee Management", icon: <FaUsers /> },
    { name: "Pending Changes", icon: <FaExclamationTriangle /> },
    { name: "Shop Preview", icon: <FaEye /> },
    { name: "Delete Business", icon: <FaTrash /> },
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
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
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
                onChange={(e) =>
                  setNewProduct({ ...newProduct, brand: e.target.value })
                }
              />
              <input
                placeholder="Model"
                value={newProduct.model}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, model: e.target.value })
                }
              />
              <textarea
                placeholder="Description"
                value={newProduct.description}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, description: e.target.value })
                }
              />
              <div className="price-input-group">
                <input
                  type="number"
                  placeholder="Price"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                />
              </div>
              <input
                type="number"
                placeholder="Quantity"
                value={newProduct.quantity}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, quantity: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="Category"
                value={newProduct.category}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, category: e.target.value })
                }
              />
              <input
                placeholder="Picture URL"
                value={newProduct.pictureUrls}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, pictureUrls: e.target.value })
                }
              />
              <input
                placeholder="Colors"
                value={newProduct.colors}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, colors: e.target.value })
                }
              />
              <select
                value={newProduct.sizes}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, sizes: e.target.value })
                }
              >
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
              </select>
              <input
                placeholder="Material"
                value={newProduct.material}
                onChange={(e) =>
                  setNewProduct({ ...newProduct, material: e.target.value })
                }
              />
              <button onClick={saveProduct}>Save Product</button>
            </div>
          </div>
        );

case "Edit Current Products":
  const filteredProducts = products.filter((p) =>
    `${p.brand} ${p.model} ${p.description}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="panel">
      <h3>Products</h3>
      <div style={{ position: 'relative', width: '90%', marginBottom: '12px' }}>
          <FaSearch
            style={{
              position: 'absolute',
              top: '35%',
              left: '8px',
              transform: 'translateY(-50%)',
              color: '#aaa',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 8px 8px 32px'  
            }}
          />
        </div>
      <ul className="product-list">
        {filteredProducts.map((p) => (
          <li key={p.clothingItemId}>
            {editingProductId === p.clothingItemId ? (
              <div className="inline-edit-form">
                {/* Inline editing form as before */}
                <input
                  placeholder="Brand"
                  value={newProduct.brand}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, brand: e.target.value })
                  }
                />
                <input
                  placeholder="Model"
                  value={newProduct.model}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, model: e.target.value })
                  }
                />
                <textarea
                  placeholder="Description"
                  value={newProduct.description}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      description: e.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={newProduct.quantity}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, quantity: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newProduct.category}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, category: e.target.value })
                  }
                />
                <input
                  placeholder="Picture URL"
                  value={newProduct.pictureUrls}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      pictureUrls: e.target.value,
                    })
                  }
                />
                <input
                  placeholder="Colors"
                  value={newProduct.colors}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, colors: e.target.value })
                  }
                />
                <select
                  value={newProduct.sizes}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, sizes: e.target.value })
                  }
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                  <option value="XXL">XXL</option>
                </select>
                <input
                  placeholder="Material"
                  value={newProduct.material}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, material: e.target.value })
                  }
                />
                <button onClick={saveProduct}>Save</button>
                <button
                  onClick={() => {
                    setEditingProductId(null);
                    setNewProduct({
                      description: "",
                      price: "",
                      quantity: "",
                      category: "",
                      brand: "",
                      model: "",
                      pictureUrls: "",
                      colors: "",
                      sizes: "XS",
                      material: "",
                    });
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="product-display">
                <span>
                  {p.brand} - {p.model} (${p.price})
                </span>
                <button
                  onClick={() => {
                    setNewProduct({
                      description: p.description,
                      price: p.price.toString(),
                      quantity: p.quantity.toString(),
                      category: p.category,
                      brand: p.brand,
                      model: p.model,
                      pictureUrls:
                        p.pictureUrls && p.pictureUrls[0]
                          ? p.pictureUrls[0]
                          : "",
                      colors: p.colors,
                      sizes:
                        typeof p.sizes === "number"
                          ? reverseSizeMapping[p.sizes] || "XS"
                          : p.sizes,
                      material: p.material,
                    });
                    setEditingProductId(p.clothingItemId);
                  }}
                >
                  Edit
                </button>
                <button onClick={() => deleteProduct(p.clothingItemId)}>
                  Delete
                </button>
              </div>
            )}
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
  <h3>Employee Management</h3>
  <div className="employee-management-container">
    {/* Left: Add New Employee */}
    <div className="employee-add-section">
      <h4>Add New Employee</h4>
      <form onSubmit={handleEmployeeSubmit} className="employee-form">
        <input
          type="text"
          placeholder="Name"
          value={newEmployee.name}
          onChange={(e) =>
            setNewEmployee({ ...newEmployee, name: e.target.value })
          }
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={newEmployee.email}
          onChange={(e) =>
            setNewEmployee({ ...newEmployee, email: e.target.value })
          }
          required
        />
        <input
          type="text"
          placeholder="Role"
          value={newEmployee.role}
          onChange={(e) =>
            setNewEmployee({ ...newEmployee, role: e.target.value })
          }
          required
        />
        <button type="submit">
          {editingEmployee ? "Update Employee" : "Add Employee"}
        </button>
      </form>
    </div>

    {/* Right: Existing Employees */}
    <div className="employee-list-section">
      <h4>Existing Employees</h4>
      {employees.length > 0 ? (
        <ul>
          {employees.map((emp) => (
            <li key={emp.id} className="employee-item">
              <span>
                {emp.name} ({emp.email})
              </span>
              <div className="employee-actions">
                <button onClick={() => handleEditEmployee(emp)}>Edit</button>
                <button onClick={() => deleteEmployee(emp.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No employees found.</p>
      )}
    </div>
  </div>
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
              <p>
                Shop preview unavailable. Please update your business shop
                settings.
              </p>
            )}
          </div>
        );
      case "Delete Business":
        return (
          <div className="panel">
            <h3>Delete Business</h3>
            <p>
              Warning: This action cannot be undone. All business data will be
              permanently removed.
            </p>
            <button
              onClick={deleteBusiness}
              style={{ backgroundColor: "red", color: "white" }}
              className="delete-button"
            >
              Delete Business
            </button>
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
                  key={item.name}
                  onClick={() => setSelectedCategory(item.name)}
                  className={`${
                    selectedCategory === item.name ? "active" : ""
                  } ${item.name === "Delete Business" ? "delete-sidebar" : ""}`}
                >
                  <span className="sidebar-icon">{item.icon}</span>
                  {item.name}
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
