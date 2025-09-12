// src/Pages/UsersPage.js
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from '../Components/Footer';
import '../Styling/userspage.css';

const API_BASE = 'https://api.triwears.com/api';
const ITEMS_PER_PAGE = 6;
const SEARCH_DEBOUNCE_MS = 300;

const UsersPage = () => {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Decode JWT once to get the current user's ID
  const currentUserId = useMemo(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const id = payload.UserId ?? payload.userId ?? payload.nameid;
      return id != null ? String(id) : null;
    } catch {
      return null;
    }
  }, []);

  // 1) Fetch users once
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API_BASE}/api/User/all`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        });
        if (res.status === 401) return navigate('/login');
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [navigate]);

  // 2) Debounce the search query
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // 3) Filtered list (memoized)
  const filtered = useMemo(() => {
    if (!debouncedQuery) return users;
    let rx;
    try {
      rx = new RegExp(debouncedQuery, 'i');
    } catch {
      return users;
    }
    return users.filter(u =>
      rx.test(u.name) ||
      rx.test(u.email) ||
      (u.telephoneNumber && rx.test(u.telephoneNumber))
    );
  }, [users, debouncedQuery]);

  // 4) Pagination calculations (memoized)
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const currentSlice = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  // Whenever filter changes, reset to page 1
  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  return (
    <>
      <Navbar />

      <div className="users-page-container">
        <h2>All Registered Users</h2>

        <input
          type="text"
          className="user-search-input"
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {/* Status line */}
        {!loading && !error && (
          <p className="status-line">
            Showing {currentSlice.length} of {filtered.length} user{filtered.length !== 1 && 's'}
          </p>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="users-list">
            {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
              <div key={i} className="user-card skeleton-card">
                <div className="avatar-placeholder" />
                <div className="info-placeholder">
                  <div className="line short" />
                  <div className="line long" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="error-text">Error: {error}</p>}

        {!loading && !error && filtered.length === 0 && (
          <p className="no-results">No users found.</p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="users-list">
              {currentSlice.map(user => (
                <div
                  key={user.userId}
                  className="user-card"
                  onClick={() =>
                    navigate(
                      String(user.userId) === currentUserId
                        ? '/my-profile'
                        : `/profile/${user.userId}`
                    )
                  }
                >
                  <img
                    src={user.profilePictureUrl || '/Assets/default-avatar.jpg'}
                    alt={`${user.name}'s avatar`}
                    className="user-avatar"
                  />
                  <div className="user-info">
                    <h3>{user.name}</h3>
                  </div>
                </div>
              ))}
            </div>

            <div className="pagination">
              <button
                className="page-button"
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={`page-button ${currentPage === i + 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}

              <button
                className="page-button"
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      <Footer />
    </>
  );
};

export default UsersPage;
