import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar';
import Footer from './Footer';
import '../Styling/userspage.css';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // <— Fix: assign fetch result to res and await it
        const res = await fetch('http://77.242.26.150:8000/api/User/all', {
          method: 'GET',
        });
        if (!res.ok) throw new Error('Failed to load users');

        const data = await res.json();
        setUsers(data);
        setFiltered(data);
      } catch (err) {
        console.error('User fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    const regex = new RegExp(q, 'i');
    setFiltered(
      users.filter(
        (u) =>
          regex.test(u.name) ||
          regex.test(u.firstName) ||
          regex.test(u.lastName) ||
          regex.test(u.username) ||
          regex.test(u.email)
      )
    );
  };

  return (
    <div>
      <Navbar />
      <div className="users-page-container">
        <h2>All Registered Users</h2>

        <input
          type="text"
          className="user-search-input"
          placeholder="Search by name, username, or email"
          value={query}
          onChange={handleSearch}
        />

        {loading ? (
          <p>Loading users...</p>
        ) : filtered.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="users-list">
            {filtered.map((user) => (
              <div
                key={user.id}
                className="user-card"
                onClick={() => navigate(`/profile/${user.id}`)}
              >
                <img
                  src={user.profileImageUrl || '/default-avatar.png'}
                  alt={`${user.name}'s avatar`}
                  className="user-avatar"
                />
                <div className="user-info">
                  <h3>{user.name}</h3>
                  <p>@{user.username || 'unknown'}</p>
                  <p>{user.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default UsersPage;
