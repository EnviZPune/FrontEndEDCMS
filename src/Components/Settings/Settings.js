import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Navbar from "../Navbar";
import "../../Styling/settings.css";
import { FaSearch } from "react-icons/fa";
import {
  FaBuilding,
  FaBoxOpen,
  FaEdit,
  FaUserEdit,
  FaUsers,
  FaExclamationTriangle,
  FaEye,
  FaTrash,
  FaBell,
  FaCalendar,
} from "react-icons/fa";


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


const safeParseJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("JSON parse error:", error);
    return null;
  }
};

const uploadImageToGCS = async (file) => {
  if (!file) return null;
  const timestamp = Date.now();
  const fileName = `${timestamp}-${file.name}`;
  const uploadUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}`;
  const txtUrl = `https://storage.googleapis.com/edcms_bucket/${fileName}.txt`;

  try {
    // Upload image
    const imageRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!imageRes.ok) throw new Error("Image upload failed");

    // Upload .txt file with image URL
    const textRes = await fetch(txtUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
      },
      body: uploadUrl,
    });

    if (!textRes.ok) throw new Error("Text file upload failed");

    return uploadUrl;
  } catch (err) {
    console.error("Upload error:", err);
    return null;
  }
};

const updateBusinessPhotos = async (businessId, updatedUrls) => {
  try {
    const token = localStorage.getItem('token'); // adjust this if stored elsewhere

    const res = await fetch(`http://77.242.26.150:8000/api/Business/${businessId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updatedUrls)
    });

    if (!res.ok) throw new Error('Failed to update photos');
    console.log('✅ Photo URLs updated on server');
  } catch (err) {
    console.error('Failed to save photo URLs:', err);
  }
};



const Settings = () => {
const LoadingOverlay = () => (
  <div className="loading-overlay">
    <div className="dots">
      <div className="dot" />
      <div className="dot" />
      <div className="dot" />
    </div>
  </div>
);
  const [authorized, setAuthorized] = useState(false);
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("Business Info");
  const [userBusinesses, setUserBusinesses] = useState([]);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [products, setProducts] = useState([]);
  const [pendingChanges, setPendingChanges] = useState([]);
  const [history, setHistory] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [newProduct, setNewProduct] = useState({
  name: "",
  description: "",
  price: "",
  quantity: "",
  clothingCategoryId: null,
  brand: "",
  model: "",
  pictureUrls: [],
  colors: "",
  sizes: "XS",
  material: "",
});

  const [editingProductId, setEditingProductId] = useState(null);
  const [myShopsPage, setMyShopsPage] = useState(1);
  const SHOPS_PER_PAGE = 10;

  useEffect(() => {
    setMyShopsPage(1);
  }, [userBusinesses]);

  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: "", color: "#000000" });
  const [editingCategory, setEditingCategory] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", role: "" });
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [foundUser, setFoundUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [coverPhoto, setCoverPhoto] = useState("");

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const sizeMapping = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 };
  const reverseSizeMapping = { 0: "XS", 1: "S", 2: "M", 3: "L", 4: "XL", 5: "XXL" };

  const handleSelectBusiness = (businessId) => {
    const business = userBusinesses.find((b) => b.businessId === businessId);
    if (business) fetchBusinessDetails(business.businessId);
  };

   
   useEffect(() => {
  if (selectedCategory !== "Notification History" || !selectedBusiness?.businessId) {
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;

  const loadHistory = async () => {
    try {
      const res = await fetch(
        `http://77.242.26.150:8000/api/Notification/business/${selectedBusiness.businessId}/history`,
        { headers: getHeaders(), signal }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      setHistory(await res.json());
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Failed to load history:", err);
        setHistory([]);
      }
    }
  };

  loadHistory();

  return () => {
    controller.abort();
  };
}, [selectedCategory, selectedBusiness?.businessId]);


    useEffect(() => {
    if (selectedCategory === "Pending Changes" && selectedBusiness) {
      fetchPendingChanges();
    }
  }, [selectedCategory, selectedBusiness]);


  useEffect(() => {
    if (
      selectedBusiness &&
      (selectedCategory === "Add New Products/Categories" ||
        selectedCategory === "Edit Current Products/Categories")
    ) {
      fetchCategories(selectedBusiness.businessId);
    }
  }, [selectedCategory, selectedBusiness]);


  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate("/unauthorized");
      return;
    }

    try {
      const decoded = jwtDecode(token);
      console.log("🔍 Decoded JWT:", decoded);

      const roleClaim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
      const rawRole = (decoded[roleClaim] || "").toLowerCase();

      if (rawRole === "owner" || rawRole === "employee") {
        setUserRole(rawRole);
        setAuthorized(true);
      } else {
        navigate("/unauthorized");
      }
    } catch (err) {
      console.error("JWT decode error:", err);
      navigate("/unauthorized");
    }
  }, [navigate]);

  const fetchReservations = async () => {
  if (!selectedBusiness) return;
  try {
    const res = await fetch(
      `${API_BASE}/api/Reservation/business/${selectedBusiness.businessId}`,
      { headers: getHeaders() }
    );
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    setReservations(data);
  } catch (err) {
    console.error('Failed to load reservations:', err);
    setReservations([]);
  }
};

const handleCompleteReservation = async (id) => {
  await fetch(`${API_BASE}/api/Reservation/${id}/complete`, {
    method: 'PUT',
    headers: getHeaders(),
  });
  fetchReservations();
};

const handleUpdateReservation = async (reservationId, newStatus) => {
  try {
    const res = await fetch(
      `${API_BASE}/api/Reservation/${reservationId}/status`,
      {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus })
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      alert('Error updating reservation: ' + errText);
      return;
    }
    alert(
      `Reservation ${
        newStatus === 'Confirmed' ? 'approved' : 'rejected'
      } successfully.`
    );
    fetchReservations();
  } catch (e) {
    console.error('Update error:', e);
    alert('Failed to update reservation status.');
  }
};


useEffect(() => {
  if (selectedCategory === 'Pending Changes' && selectedBusiness) {
    fetchPendingChanges();
  }
  if (selectedCategory === 'Reservations' && selectedBusiness) {
    fetchReservations();
  }
}, [selectedCategory, selectedBusiness]);



const fetchNotifications = async () => {
  const res = await fetch(
    `http://77.242.26.150:8000/api/Notification`,
    { headers: getHeaders() }
  );
  if (!res.ok) {
    console.error("Failed to load notifications", res.status);
    return;
  }
  const data = await res.json();
  setNotifications(data);
};


useEffect(() => {
  if (selectedBusiness?.businessId) {
    fetchNotifications();
  }
}, [selectedBusiness]);



  useEffect(() => {
    if (!authorized) return;

    const fetchBusinesses = async () => {
      const res = await fetch(
          `${API_BASE}/api/Business/my/businesses`,
          { headers: getHeaders() }
        );
      const data = (await safeParseJson(res)) || [];
      setUserBusinesses(data);
      if (data.length > 0) fetchBusinessDetails(data[0].businessId);
      setIsLoading(false);
    };

    fetchBusinesses();
  }, [authorized]);

  const fetchBusinessDetails = async (businessId) => {
    const res = await fetch(`http://77.242.26.150:8000/api/Business/${businessId}`, {
      headers: getHeaders(),
    });
    const data = (await safeParseJson(res)) || {};
    setSelectedBusiness(data);
    setFormData({ name: data.name, description: data.description });
    fetchProducts(businessId);
    fetchCategories(businessId);
    fetchBusinessEmployees(businessId);
    fetchPendingChanges();
  };

const fetchProducts = async (businessId) => {
  const res = await fetch(
    `${API_BASE}/api/ClothingItem/business/${businessId}`,
    { headers: getHeaders() }
  );
  const data = (await safeParseJson(res)) || [];

const norm = data.map(item => ({
  ...item,
}));

  setProducts(norm);
};



  const fetchBusinessEmployees = async (businessId) => {
    const res = await fetch(
      `http://77.242.26.150:8000/api/Business/${businessId}/employees`,
      { headers: getHeaders() }
    );
    if (!res.ok) {
      console.error("Failed to load employees", res.status);
      return;
    }
    const data = (await safeParseJson(res)) || [];
    setEmployees(data);
  };

  // --- CATEGORY API calls (unchanged) ---
  const fetchCategories = async (businessId) => {
    const res = await fetch(
      `http://77.242.26.150:8000/api/ClothingCategory/business/${businessId}`,
      {
        headers: getHeaders(),
      }
    );
    const data = (await safeParseJson(res)) || [];
    setCategories(data);
  };

 const saveCategory = async () => {
  let url, method;
  if (editingCategory) {
    // use the correct field for the category ID
    url = `http://77.242.26.150:8000/api/ClothingCategory/${editingCategory.clothingCategoryId}`;
    method = "PUT";
  } else {
    url = "http://77.242.26.150:8000/api/ClothingCategory";
    method = "POST";
  }

  const body = {
    businessId: selectedBusiness.businessId,
    name: newCategory.name,
    colorHex: newCategory.color
  };

  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  alert(
    res.ok
      ? editingCategory
        ? "Category updated!"
        : "Category added!"
      : "Failed to save category."
  );

  fetchCategories(selectedBusiness.businessId);
  setNewCategory({ name: "", color: "#000000" });
  setEditingCategory(null);
};


  const deleteCategory = async (clothingCategoryId) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      const res = await fetch(
        `http://77.242.26.150:8000/api/ClothingCategory/${clothingCategoryId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );
      alert(res.ok ? "Category deleted!" : "Failed to delete category.");
      fetchCategories(selectedBusiness.businessId);
    }
  };
  // --- End Category API calls ---

  const fetchPendingChanges = async () => {
    if (!selectedBusiness) return;
  
    const res = await fetch(
      `http://77.242.26.150:8000/api/ProposedChanges/pending/${selectedBusiness.businessId}`,
      { headers: getHeaders() }
    );
    const data = (await safeParseJson(res)) || [];
    console.log("pendingChanges payload:", data);
    setPendingChanges(data);
  };

const approveChange = async (change) => {
  const { proposedChangeId, operationType, clothingItemId } = change;

  if (operationType === "Delete") {
    if (!window.confirm("Remove this item permanently?")) return;
    await fetch(`http://77.242.26.150:8000/api/ClothingItem/${clothingItemId}`, {
      method: "DELETE", headers: getHeaders()
    });
    setPendingChanges((pcs) =>
      pcs.filter((pc) => pc.proposedChangeId !== proposedChangeId)
    );
    fetchProducts(selectedBusiness.businessId);
    return;
  }

  await fetch(
    `http://77.242.26.150:8000/api/ProposedChanges/${proposedChangeId}?approve=true`,
    { method: "PUT", headers: getHeaders() }
  );
  fetchPendingChanges();
  fetchProducts(selectedBusiness.businessId);
};

const rejectChange = async (change) => {
  const { proposedChangeId } = change;
  await fetch(
    `http://77.242.26.150:8000/api/ProposedChanges/${proposedChangeId}?approve=false`,
    { method: "PUT", headers: getHeaders() }
  );
  fetchPendingChanges();
  fetchProducts(selectedBusiness.businessId);
};

  useEffect(() => {
    if (selectedCategory === "Pending Changes" && selectedBusiness) {
      fetchPendingChanges();
    }
  }, [selectedCategory, selectedBusiness]);

  const saveBusinessInfo = async () => {
    const res = await fetch(
      `http://77.242.26.150:8000/api/Business/${selectedBusiness.businessId}`,
      {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify({ ...selectedBusiness, ...formData }),
      }
    );
    alert(res.ok ? "Business info updated!" : "Failed to update business.");
  };

const saveProduct = async () => {
  // ─── Employee branch: propose a change ───
  if (userRole === "employee") {
    const dto = {
      businessId: selectedBusiness.businessId,
      type: editingProductId ? "Update" : "Create",
      itemDto: {
        clothingItemId: editingProductId || 0,
        name: newProduct.name,
        businessIds: [selectedBusiness.businessId],
        description: newProduct.description,
        price: parseFloat(newProduct.price),
        quantity: parseInt(newProduct.quantity, 10),
        clothingCategoryId:
          newProduct.clothingCategoryId != null
            ? parseInt(newProduct.clothingCategoryId, 10)
            : null,
        brand: newProduct.brand,
        model: newProduct.model,
        pictureUrls:
          typeof newProduct.pictureUrls === "string"
            ? [newProduct.pictureUrls]
            : newProduct.pictureUrls,
        colors:
          typeof newProduct.colors === "string"
            ? newProduct.colors.split(",").map((c) => c.trim())
            : Array.isArray(newProduct.colors)
            ? newProduct.colors
            : [],
        sizes:
          typeof newProduct.sizes === "number"
            ? newProduct.sizes
            : sizeMapping[newProduct.sizes],
        material: newProduct.material,
      },
    };

    try {
      await fetch(
        "http://77.242.26.150:8000/api/ProposedChanges/submit",
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(dto),
        }
      );
      alert(
        "Your change has been proposed. Please wait for an owner to approve or reject."
      );
      // reset form
      setNewProduct({
        name: "",
        description: "",
        price: "",
        quantity: "",
        clothingCategoryId: null,
        brand: "",
        model: "",
        pictureUrls: [],
        colors: "",
        sizes: "XS",
        material: "",
      });
      setEditingProductId(null);
      fetchProducts(selectedBusiness.businessId);
    } catch (err) {
      console.error("Failed to propose a change:", err);
      alert("Network error when proposing change.");
    }
    return;
  }

  // ─── Owner branch: immediate create/update ───
  const method = editingProductId ? "PUT" : "POST";
const url = editingProductId
  ? `http://77.242.26.150:8000/api/ClothingItem/${editingProductId}`
  : "http://77.242.26.150:8000/api/ClothingItem";

// build the DTO (no wrapping in { dto: ... })
const dto = {
  name: newProduct.name,
  businessIds: [selectedBusiness.businessId],
  description: newProduct.description,
  price: parseFloat(newProduct.price),
  quantity: parseInt(newProduct.quantity, 10),
  clothingCategoryId:
    newProduct.clothingCategoryId != null
      ? parseInt(newProduct.clothingCategoryId, 10)
      : null,
  brand: newProduct.brand,
  model: newProduct.model,
  pictureUrls:
    typeof newProduct.pictureUrls === "string"
      ? [newProduct.pictureUrls]
      : Array.isArray(newProduct.pictureUrls)
      ? newProduct.pictureUrls
      : [],
  colors:
    typeof newProduct.colors === "string"
      ? newProduct.colors.split(",").map((c) => c.trim())
      : Array.isArray(newProduct.colors)
      ? newProduct.colors
      : [],
  sizes:
    typeof newProduct.sizes === "number"
      ? newProduct.sizes
      : sizeMapping[newProduct.sizes],
  material: newProduct.material,
};

try {
  const res = await fetch(url, {
    method,
    headers: getHeaders(),
    // ✅ SEND DTO DIRECTLY (no envelope)
    body: JSON.stringify(dto),
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

setNewProduct({
  name: "",
  description: "",
  price: "",
  quantity: "",
  clothingCategoryId: null,
  brand: "",
  model: "",
  pictureUrls: [],
  colors: "",
  sizes: "XS",
  material: "",
});
setEditingProductId(null);
fetchProducts(selectedBusiness.businessId);
};


  const saveProfileCoverPhotos = async () => {
    console.log(
      "saveProfileCoverPhotos called → userRole:",
      userRole,
      "profilePhoto:",
      profilePhoto,
      "coverPhoto:",
      coverPhoto
    );

    if (!profilePhoto && !coverPhoto) {
      alert("Please enter at least one image URL to update.");
      return;
    }

    // Build a small object containing only the new URLs:
    const photoPayload = {};
    if (profilePhoto) {
      photoPayload.profilePhotoUrl = profilePhoto;
    }
    if (coverPhoto) {
      photoPayload.coverPhotoUrl = coverPhoto;
    }

    
    if (userRole === "employee") {
      try {
        const dto = {
          businessId: selectedBusiness.businessId,
          type: "UpdatePhotos",
          itemDto: {
            clothingItemId: 0,
            name: "",
            businessIds: [selectedBusiness.businessId],
            description: "",
            price: 0,
            quantity: 0,
            clothingCategoryId: null,
            brand: "",
            model: "",
            pictureUrls: [],
            colors: [],
            sizes: 0,
            material: "",
            profilePhotoUrl: profilePhoto,
            coverPhotoUrl:   coverPhoto
          }
        };
    
        await fetch("http://77.242.26.150:8000/api/ProposedChanges/submit", {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(dto),
        });
    
        alert(
          "Your photo‐change request has been submitted. Please wait for an owner to approve or reject."
        );
        setProfilePhoto("");
        setCoverPhoto("");
        if (selectedCategory === "Pending Changes") {
          fetchPendingChanges();
        }
      } catch (err) {
        console.error("Network error when proposing photo change:", err);
        alert("Failed to propose photo change.");
      }
      return;
    }    

    try {
      const updatedBusiness = {
        ...selectedBusiness,
        ...photoPayload,
      };
      const res = await fetch(
        `http://77.242.26.150:8000/api/Business/${selectedBusiness.businessId}`,
        {
          method: "PUT",
          headers: getHeaders(),
          body: JSON.stringify(updatedBusiness),
        }
      );
      alert(res.ok ? "Profile updated!" : "Failed to update profile.");
      if (res.ok) fetchBusinessDetails(selectedBusiness.businessId);
    } catch (err) {
      console.error("Network error when updating business:", err);
      alert("Failed to update profile due to network error.");
    }
  };

  const deleteProduct = async (clothingItemId) => {
    // EMPLOYEE: submit a Delete proposal
    if (userRole === "employee") {
      // grab the original item so we can include its name and businessIds
      const original =
        products.find((p) => p.clothingItemId === clothingItemId) || {};
  
      const dto = {
        businessId: selectedBusiness.businessId,
        type: "Delete",
        itemDto: {
          clothingItemId,
          name: original.name || "",                          // required
          businessIds:                                     // required
            Array.isArray(original.businessIds) &&
            original.businessIds.length > 0
              ? original.businessIds
              : [selectedBusiness.businessId],
        },
      };
  
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/ProposedChanges/submit`,
          {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(dto),
          }
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
  
        alert(
          "Your delete request has been submitted. Please wait for an owner to approve or reject."
        );
        fetchPendingChanges(); // so owner sees it right away
      } catch (err) {
        console.error("Failed to propose delete:", err);
        alert("Network error when proposing delete.");
      }
  
      return;
    }
  
    // OWNER: confirm & hard delete
    if (
      window.confirm(
        "Are you sure you want to permanently delete this product?"
      )
    ) {
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/ClothingItem/${clothingItemId}`,
          {
            method: "DELETE",
            headers: getHeaders(),
          }
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
  
        alert("Product deleted successfully.");
        fetchProducts(selectedBusiness.businessId);
      } catch (err) {
        console.error("Failed to delete product:", err);
        alert("Network error when deleting product.");
      }
    }
  };
  

  const deleteBusiness = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this business? This action cannot be undone."
      )
    ) {
      const res = await fetch(
        `http://77.242.26.150:8000/api/Business/${selectedBusiness.businessId}`,
        {
          method: "DELETE",
          headers: getHeaders(),
        }
      );
      if (res.ok) {
        alert("Business deleted successfully.");
        navigate("/preview");
      } else {
        alert("Failed to delete business. Error " + res.status);
      }
    }
  };

  const API_BASE = "http://77.242.26.150:8000";

  const findUserByEmail = async () => {
    const email = newEmployee.email.trim().toLowerCase();
    if (!email) {
      alert("Please enter an email to search.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/User/email/${encodeURIComponent(email)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        }
      );

      if (res.status === 404) {
        setFoundUser(null);
        alert("User not found.");
        return;
      }
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const user = await res.json();
      setFoundUser(user);
      setNewEmployee((prev) => ({ ...prev, name: user.name || "" }));
      alert(`User has been found: ${user.name}`);
    } catch (err) {
      console.error("Error searching user:", err);
      alert("Network or server error when searching for user.");
    }
  };

  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBusiness) {
      alert("Select a business first.");
      return;
    }
    if (!foundUser?.userId) {
      alert("Find a user by email first.");
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/Business/${selectedBusiness.businessId}/assign/${foundUser.userId}`,
      { method: "POST", headers: getHeaders() }
    );
    if (res.ok) {
      alert("Invitation sent!");
      await fetchBusinessEmployees(selectedBusiness.businessId);
    } else {
      console.error("Invite failed:", await res.text());
      alert("Failed to invite.");
    }

    setFoundUser(null);
    setNewEmployee({ name: "", email: "", role: "" });
  };

  // Edit button (not implemented server-side, kept for UI consistency)
  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setNewEmployee({ name: emp.name || "", email: emp.email || "" });
  };

  // Remove an employee
  const deleteEmployee = async (userId) => {
    if (!userId || !selectedBusiness) return alert("Invalid employee.");
    if (!window.confirm("Remove this employee?")) return;

    const res = await fetch(
      `${API_BASE}/api/Business/${selectedBusiness.businessId}/employees/${userId}`,
      { method: "DELETE", headers: getHeaders() }
    );
    if (res.ok) {
      alert("Employee removed.");
      await fetchBusinessEmployees(selectedBusiness.businessId);
    } else {
      console.error("Remove failed:", await res.text());
      alert("Failed to remove employee.");
    }
  };

  const sidebarItems = [
    { name: "Business Info", icon: <FaBuilding /> },
    { name: "Add New Products/Categories", icon: <FaBoxOpen /> },
    { name: "Edit Current Products/Categories", icon: <FaEdit /> },
    { name: "Edit Profile/Cover Photo", icon: <FaUserEdit /> },
    { name: "Employee Management", icon: <FaUsers /> },
    { name: "Pending Changes", icon: <FaExclamationTriangle /> },
    { name: "My Shops", icon: <FaEye /> },
    { name: "Notification History", icon: <FaBell />},
    { name: 'Reservations', icon: <FaCalendar /> },
    { name: "Delete Business", icon: <FaTrash /> },
  ];

  let visibleSidebarItems;
  if (userRole === "owner") {
    visibleSidebarItems = sidebarItems;
  } else {
    visibleSidebarItems = sidebarItems.filter((item) =>
      [
        "Add New Products/Categories",
        "Edit Current Products/Categories",
        "My Shops",
        "Reservations",
      ].includes(item.name)
    );
    if (!visibleSidebarItems.some((i) => i.name === selectedCategory)) {
      setSelectedCategory(visibleSidebarItems[0]?.name || "");
    }
  }
    if (isLoading) {
  return <LoadingOverlay />;
}

  const renderContent = () => {
    if (!selectedBusiness) return <p>Please select a business to manage.</p>;

    switch (selectedCategory) {
      case "Business Info":
        return (
          <div className="panel">
            <h3>Edit Business Info</h3>
            <label>
              <b>Business Name</b>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />

            <label>
              <b>Description</b>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />

            <label>
              <b>NIPT</b>
            </label>
            <input
              type="text"
              value={selectedBusiness.nipt || ""}
              onChange={(e) =>
                setSelectedBusiness({
                  ...selectedBusiness,
                  nipt: e.target.value,
                })
              }
            />

            <label>
              <b>Adress</b>
            </label>
            <input
              type="text"
              value={selectedBusiness.address || ""}
              onChange={(e) =>
                setSelectedBusiness({
                  ...selectedBusiness,
                  address: e.target.value,
                })
              }
            />

            <label>
              <b>Location</b>
            </label>
            <input
              type="text"
              value={selectedBusiness.location || ""}
              onChange={(e) =>
                setSelectedBusiness({
                  ...selectedBusiness,
                  location: e.target.value,
                })
              }
            />

            <label>
              <b>Opening Hours</b>
            </label>
            <input
              type="text"
              value={selectedBusiness.openingHours || ""}
              onChange={(e) =>
                setSelectedBusiness({
                  ...selectedBusiness,
                  openingHours: e.target.value,
                })
              }
            />

            <label>
              <b>Business Phone Number</b>
            </label>
            <input
              type="tel"
              value={selectedBusiness.businessPhoneNumber || ""}
              onChange={(e) =>
                setSelectedBusiness({
                  ...selectedBusiness,
                  businessPhoneNumber: e.target.value,
                })
              }
            />

            <button onClick={saveBusinessInfo}>Save</button>
          </div>
        );

      case "Add New Products/Categories":
  return (
    <div className="dual-panel">
      {/* ─── Add Product ─── */}
      <div className="panel">
        <h3>Add Product</h3>

        <input
          placeholder="Name"
          value={newProduct.name || ""}
          onChange={e =>
            setNewProduct({ ...newProduct, name: e.target.value })
          }
        />

        <input
          placeholder="Brand"
          value={newProduct.brand}
          onChange={e =>
            setNewProduct({ ...newProduct, brand: e.target.value })
          }
        />

        <input
          placeholder="Model"
          value={newProduct.model}
          onChange={e =>
            setNewProduct({ ...newProduct, model: e.target.value })
          }
        />

        <textarea
          placeholder="Description"
          value={newProduct.description}
          onChange={e =>
            setNewProduct({ ...newProduct, description: e.target.value })
          }
        />

        <div className="price-input-group">
          <input
            type="number"
            placeholder="Price"
            value={newProduct.price}
            onChange={e =>
              setNewProduct({ ...newProduct, price: e.target.value })
            }
          />
        </div>

        <input
          type="number"
          placeholder="Quantity"
          value={newProduct.quantity}
          onChange={e =>
            setNewProduct({ ...newProduct, quantity: e.target.value })
          }
        />

        <label>
          Category
<select
  value={newProduct.clothingCategoryId ?? ""}
  onChange={e =>
    setNewProduct({
      ...newProduct,
      clothingCategoryId: e.target.value ? +e.target.value : null
    })
  }
>
  <option value="">-- Select category --</option>
  {categories.map(cat => (
    <option key={cat.clothingCategoryId} value={cat.clothingCategoryId}>
      {cat.name}
    </option>
  ))}
</select>
        </label>

        <label>
          <b>Upload Product Photos (max 10)</b>
        </label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={async e => {
            const files = Array.from(e.target.files);
            const current = Array.isArray(newProduct.pictureUrls)
              ? [...newProduct.pictureUrls]
              : [];
            for (const f of files) {
              if (current.length >= 10) break;
              const url = await uploadImageToGCS(f);
              if (url) current.push(url);
            }
            setNewProduct({ ...newProduct, pictureUrls: current });
          }}
        />

        <div className="product-photo-preview">
          {Array.isArray(newProduct.pictureUrls) &&
            newProduct.pictureUrls.map((url, idx) => (
              <div key={idx} className="product-photo-container">
                <img src={url} alt={`Uploaded ${idx}`} />
                <button
                  type="button"
                  className="remove-photo-button"
                  onClick={() =>
                    setNewProduct({
                      ...newProduct,
                      pictureUrls: newProduct.pictureUrls.filter(
                        (_, i) => i !== idx
                      )
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
        </div>

        <input
          placeholder="Colors"
          value={newProduct.colors}
          onChange={e =>
            setNewProduct({ ...newProduct, colors: e.target.value })
          }
        />
        <select
          value={newProduct.sizes}
          onChange={e =>
            setNewProduct({ ...newProduct, sizes: e.target.value })
          }
        >
          {["XS", "S", "M", "L", "XL", "XXL"].map(sz => (
            <option key={sz} value={sz}>
              {sz}
            </option>
          ))}
        </select>
        <input
          placeholder="Material"
          value={newProduct.material}
          onChange={e =>
            setNewProduct({ ...newProduct, material: e.target.value })
          }
        />

        <button onClick={saveProduct}>Save Product</button>
      </div>

      <div className="panel">
        <h3>{editingCategory ? "Edit" : "Add"} Category</h3>

        <input
          type="text"
          placeholder="Category Name"
          value={newCategory.name}
          onChange={e =>
            setNewCategory({ ...newCategory, name: e.target.value })
          }
        />

        <button onClick={saveCategory}>
          {editingCategory ? "Update" : "Add"} Category
        </button>
      </div>
    </div>
  );

      case "Edit Current Products/Categories":
        const filteredProducts = products.filter((p) =>
          `${p.name} ${p.brand} ${p.model} ${p.description}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        );
        return (
          <div className="panel merged-panel">
            <div className="product-section">
              <h3>Products</h3>
              <div
                style={{
                  position: "relative",
                  width: "90%",
                  marginBottom: "12px",
                }}
              >
                <FaSearch
                  style={{
                    position: "absolute",
                    top: "35%",
                    left: "8px",
                    transform: "translateY(-50%)",
                    color: "#aaa",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "8px 8px 8px 32px" }}
                />
              </div>
              <ul className="product-list">
                {filteredProducts.map((p) => (
                  <li key={p.clothingItemId}>
                    {editingProductId === p.clothingItemId ? (
                      <div className="inline-edit-form">
                        <input
                          placeholder="Name"
                          value={newProduct.name || ""}
                          onChange={(e) =>
                            setNewProduct({ ...newProduct, name: e.target.value })
                          }
                        />
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
                        <label>
                  <b>Category</b>
                <select
                  value={newProduct.clothingCategoryId ?? ""}
                  onChange={e =>
                    setNewProduct({
                      ...newProduct,
                      clothingCategoryId: e.target.value ? +e.target.value : null
                    })
                  }
                >
                  <option value="">— No category —</option>
                  {categories.map(c => (
                    <option key={c.clothingCategoryId} value={c.clothingCategoryId}>
                      {c.name}
                    </option>
                  ))}
                </select>
                </label>
                        <label>
                      <b>Add/Remove Product Photos</b>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        const currentUrls = Array.isArray(newProduct.pictureUrls)
                          ? [...newProduct.pictureUrls]
                          : [];

                        for (const file of files) {
                          if (currentUrls.length >= 10) break;
                          const url = await uploadImageToGCS(file);
                          if (url) currentUrls.push(url);
                        }

                        setNewProduct({ ...newProduct, pictureUrls: currentUrls });
                      }}
                    />
                    <div className="product-photo-preview">
                      {Array.isArray(newProduct.pictureUrls) &&
                        newProduct.pictureUrls.map((url, idx) => (
                          <div key={idx} className="product-photo-container">
                            <img src={url} alt={`Uploaded ${idx}`} />
                            <button
                              type="button"
                              onClick={() =>
                                setNewProduct({
                                  ...newProduct,
                                  pictureUrls: newProduct.pictureUrls.filter((_, i) => i !== idx),
                                })
                              }
                              className="remove-photo-button"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                    </div>
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
                              name: "",
                              description: "",
                              price: "",
                              quantity: "",
                              clothingCategoryId: null,
                              brand: "",
                              model: "",
                              pictureUrls: "",
                              colors: "",
                              sizes: "XS",
                              material: "",
                              pictureUrls: [],
                            });
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="product-display">
                        <span>
                          {p.name} - {p.model} (${p.price})
                        </span>
                        <button
                          onClick={() => {
                                setNewProduct({
                            name: p.name || "",
                            description: p.description,
                            price: p.price.toString(),
                            quantity: p.quantity.toString(),
                        clothingCategoryId: Array.isArray(p.clothingCategoryId)
                          ? p.clothingCategoryId
                          : p.clothingCategoryId!= null
                          ? [p.clothingCategoryId]
                          : [],
                            brand: p.brand,
                            model: p.model,
                            pictureUrls: Array.isArray(p.pictureUrls)
                              ? p.pictureUrls
                              : [p.pictureUrls],
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
            <div className="category-section" style={{ marginTop: "24px" }}>
              <h3>Categories</h3>
             <ul className="category-list">
                {categories.map((cat) => (
                  <li key={cat.clothingCategoryId}>
                <span>{cat.name}</span>
                <button
                  onClick={() => {
                    setEditingCategory(cat);
                    setNewCategory({
                      name: cat.name,
                      color: cat.colorHex || "#000000"    // ← pull in the existing color
                    });
                  }}
                >
                  Edit
                </button>
                <button onClick={() => deleteCategory(cat.clothingCategoryId)}>
                  Delete
                </button>
              </li>
                ))}
              </ul>
              
              {editingCategory && (
              <div className="category-form" style={{ marginTop: "12px" }}>
                <input
                  type="text"
                  placeholder="Category Name"
                  value={newCategory.name}
                  onChange={e =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                />
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={e =>
                    setNewCategory({ ...newCategory, color: e.target.value })
                  }
                />
                <button onClick={() => { saveCategory(); setEditingCategory(null); }}>
                  Update Category
              </button>
              <button onClick={() => setEditingCategory(null)}>
                Cancel
             </button>
             </div>
           )}

            </div>
          </div>
        );

        case 'Edit Profile/Cover Photo':
  return (
    <div className="panel">
      <h3>Edit Profile/Cover Photo</h3>

      <label>Profile Photo</label>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files[0];
          if (file) {
            const url = await uploadImageToGCS(file);
            if (url) {
              setProfilePhotoUrl(url);
            } else {
              alert('Failed to upload profile photo.');
            }
          }
        }}
      />

      <label>Cover Photo</label>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files[0];
          if (file) {
            const url = await uploadImageToGCS(file);
            if (url) {
              setCoverPhotoUrl(url);
            } else {
              alert('Failed to upload cover photo.');
            }
          }
        }}
      />

      <div style={{ marginTop: '1rem', display: 'flex', gap: '16px' }}>
        {profilePhotoUrl && (
          <div>
            <p>Profile Preview:</p>
            <img src={profilePhotoUrl} alt="Profile" width="120" />
          </div>
        )}
        {coverPhotoUrl && (
          <div>
            <p>Cover Preview:</p>
            <img src={coverPhotoUrl} alt="Cover" width="120" />
          </div>
        )}
      </div>

      <button
        style={{ marginTop: '1rem' }}
        onClick={async () => {
          const updatedData = {
            ...selectedBusiness,
            profilePictureUrl: profilePhotoUrl || selectedBusiness.profilePictureUrl,
            coverPictureUrl: coverPhotoUrl || selectedBusiness.coverPictureUrl,
            name: selectedBusiness.name,
            description: selectedBusiness.description,
            address: selectedBusiness.address,
            location: selectedBusiness.location,
            businessPhoneNumber: selectedBusiness.businessPhoneNumber,
            nipt: selectedBusiness.nipt,
            openingHours: selectedBusiness.openingHours
          };

          const success = await updateBusinessPhotos(selectedBusiness.businessId, updatedData);
          if (success !== false) {
            alert('Photos updated successfully.');
          } else {
            alert('Update failed.');
          }
        }}
      >
        Save Changes
      </button>
    </div>
  );

      case "Employee Management":
        return (
          <div className="panel">
            <h3>Employee Management</h3>
            <div className="employee-management-container">
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
                  <button type="button" onClick={findUserByEmail}>
                    Find User by Email
                  </button>
                  <button type="submit">
                    {editingEmployee ? "Update Employee" : "Add Employee"}
                  </button>
                </form>
              </div>
              <div className="employee-list-section">
                <h4>Existing Employees</h4>
                {employees.length > 0 ? (
                  <ul>
                    {employees.map((emp) => (
                      <li key={emp.userId} className="employee-item">
                        <span>
                          {emp.name} ({emp.email})
                        </span>
                        <div className="employee-actions">
                          <button onClick={() => handleEditEmployee(emp)}>
                            Edit
                          </button>
                          <button onClick={() => deleteEmployee(emp.userId)}>
                            Delete
                          </button>
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
              {pendingChanges.length === 0 ? (
                <p>No pending changes.</p>
              ) : (
                <ul className="pending-list">
                  {pendingChanges.map((change) => {
                    let parsed = {};
                    try {
                      parsed = JSON.parse(change.changeDetails);
                    } catch {}
        
                    const norm = {};
                    Object.entries(parsed).forEach(([k, v]) => {
                      const lk = k.charAt(0).toLowerCase() + k.slice(1);
                      norm[lk] = v;
                    });
        
                    if (change.operationType === "UpdatePhotos") {
                      const photos = norm.itemDto || norm;
                      const { profilePhotoUrl, coverPhotoUrl } = photos;
                      return (
                        <li
                          key={change.proposedChangeId}
                          className="pending-item styled-box"
                        >
                          <div className="pending-item-header">
                            <strong>Photo Update</strong>
                          </div>
                          <div className="pending-item-meta">
                            <small>
                              <strong>Requested By:</strong>{" "}
                              {
                                employees.find((e) => e.userId === change.employeeId)
                                  ?.name || "Unknown"
                              }
                            </small>
                            <br />
                            <small>
                              <strong>Requested At:</strong>{" "}
                              {new Date(change.createdAt).toLocaleString()}
                            </small>
                          </div>
        
                          <div className="photo-details-container">
                            <h4 className="change-details-title">
                              Photo Update Details
                            </h4>
                            <div className="photo-update-grid">
                              {profilePhotoUrl && (
                                <div className="photo-item">
                                  <span className="photo-label">Profile Photo</span>
                                  <img
                                    src={profilePhotoUrl}
                                    alt="Requested Profile"
                                    className="photo-preview"
                                  />
                                </div>
                              )}
                              {coverPhotoUrl && (
                                <div className="photo-item">
                                  <span className="photo-label">Cover Photo</span>
                                  <img
                                    src={coverPhotoUrl}
                                    alt="Requested Cover"
                                    className="photo-preview"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
        
                          <div className="pending-item-actions">
                          <button
                        className="approve-btn"
                        onClick={() => approveChange(change)}
                      >
                        Approve
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => rejectChange(change)}
                      >
                        Reject
                      </button>
                          </div>
                        </li>
                      );
                    }
                      const original =
                      products.find(
                        (p) => p.clothingItemId === change.clothingItemId
                      ) || {};
                    const fields = [
                      "name",
                      "description",
                      "price",
                      "quantity",
                      "category",
                      "brand",
                      "model",
                      "material",
                    ];
                    const diffs = fields
                      .map((key) => {
                        const oldVal = original[key];
                        const newVal = norm[key];
                        if (newVal != null && String(oldVal) !== String(newVal)) {
                          return { key, oldVal, newVal };
                        }
                        return null;
                      })
                      .filter(Boolean);
        
                    return (
                      <li
                        key={change.proposedChangeId}
                        className="pending-item styled-box"
                      >
                        <div className="pending-item-header">
                          <strong>{change.operationType}</strong>
                        </div>
                        <div className="pending-item-meta">
                          <small>
                            <strong>Requested By:</strong>{" "}
                            {
                              employees.find((e) => e.userId === change.employeeId)
                                ?.name || "Unknown"
                            }
                          </small>
                          <br />
                          <small>
                            <strong>Requested At:</strong>{" "}
                            {new Date(change.createdAt).toLocaleString()}
                          </small>
                        </div>
        
                        {diffs.length > 0 && (
                          <div className="change-details-container">
                            <h4 className="change-details-title">
                              Requested Changes:
                            </h4>
                            <table className="diff-table">
                              <thead>
                                <tr>
                                  <th>Field</th>
                                  <th>Current Value</th>
                                  <th>Requested Value</th>
                                </tr>
                              </thead>
                              <tbody>
                                {diffs.map(({ key, oldVal, newVal }) => {
                                  const label = key
                                    .replace(/([A-Z])/g, " $1")
                                    .replace(/^./, (s) => s.toUpperCase());
                                  return (
                                    <tr key={key}>
                                      <td><strong>{label}</strong></td>
                                      <td>{String(oldVal)}</td>
                                      <td>{String(newVal)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
        
                        <div className="pending-item-actions">
                          <button
                            className="approve-btn"
                            onClick={() => approveChange(change)}
                          >
                            Approve
                          </button>
                          <button
                            className="reject-btn"
                            onClick={() => rejectChange(change)}
                          >
                            Reject
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );        
        
        case "My Shops": {
          const totalPages = Math.ceil(userBusinesses.length / SHOPS_PER_PAGE);
          const startIdx   = (myShopsPage - 1) * SHOPS_PER_PAGE;
          const pageShops  = userBusinesses.slice(startIdx, startIdx + SHOPS_PER_PAGE);
        
          return (
            <>
              <div className="settings-myshops-container">
                {pageShops.map(shop => (
                  <Link
                    to={`/shops/${shop.businessId}`}
                    key={shop.businessId}
                    className="settings-myshops-card-link"
                  >
                    <div
                      className="settings-myshops-card"
                      style={{ backgroundImage: `url(${shop.coverPictureUrl})` }}
                    >
                      <div className="settings-myshops-overlay" />
                      <div className="settings-myshops-content">
                        <div className="settings-myshops-header">
                          <h3 className="settings-myshops-name">{shop.name}</h3>
                        </div>
                        {shop.description && (
                          <p className="settings-myshops-description">
                            {shop.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
        
              <div className="settings-myshops-pagination">
                <button
                  className="settings-myshops-page-button"
                  onClick={() => setMyShopsPage(p => p - 1)}
                  disabled={myShopsPage === 1}
                >
                  Prev
                </button>
        
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`settings-myshops-page-button${
                      myShopsPage === i + 1 ? " active" : ""
                    }`}
                    onClick={() => setMyShopsPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                ))}
        
                <button
                  className="settings-myshops-page-button"
                  onClick={() => setMyShopsPage(p => p + 1)}
                  disabled={myShopsPage === totalPages}
                >
                  Next
                </button>
              </div>
            </>
          );
        };
        
case "Notification History":
  return (
    <div className="panel">
      <h3>Notification History</h3>
      {history.length === 0 ? (
        <p>No notifications ever sent.</p>
      ) : (
        <ul className="notification-list">
          {history.map(n => (
            <li key={n.id ?? n.notificationId} className="notification-entry">
              <p>{n.message}</p>
              <small>{new Date(n.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

case "Reservations": {
  const reserved = reservations.filter(r => r.status === "Confirmed");

  return (
    <div className="panel">
      <h3>Product Reservations</h3>

      <section style={{ marginTop: "1rem" }}>
        <h4>Reserved Products</h4>
        {reserved.length === 0 ? (
          <p>No approved reservations.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Product</th>
                <th>Shop</th>
                <th>Customer</th>
                <th>Created At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reserved.map(r => (
                <tr key={r.reservationId}>
                  <td>{r.reservationId}</td>
                  <td>{r.productName}</td>
                  <td>{r.shopName}</td>
                  <td>{r.customerName}</td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.status}</td>
                  <td>
                    <button
                      onClick={() =>
                        handleCompleteReservation(r.reservationId)
                      }
                    >
                      Mark Completed
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h4>Pending Reservations</h4>
        {reservations.filter(r => r.status === "Pending").length === 0 ? (
          <p>No pending reservations.</p>
        ) : (
          <table className="reservations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Product</th>
                <th>Customer</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations
                .filter(r => r.status === "Pending")
                .map(r => (
                  <tr key={r.reservationId}>
                    <td>{r.reservationId}</td>
                    <td>{r.productName}</td>
                    <td>{r.customerName}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() =>
                          handleUpdateReservation(r.reservationId, "Confirmed")
                        }
                      >
                        Approve
                      </button>{" "}
                      <button
                        onClick={() =>
                          handleUpdateReservation(r.reservationId, "Cancelled")
                        }
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

      case "Delete Business":
        return (
          <div className="panel">
            <h3>Delete Business</h3>
            <p>
              Warning: This action cannot be undone. All business data will
              be permanently removed.
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
              onChange={(e) =>
                handleSelectBusiness(parseInt(e.target.value, 10))
              }
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
              {visibleSidebarItems.map((item) => (
                <li
                  key={item.name}
                  onClick={() => setSelectedCategory(item.name)}
                  className={`${
                    selectedCategory === item.name ? "active" : ""
                  } ${
                    item.name === "Delete Business" ? "delete-sidebar" : ""
                  }`}
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