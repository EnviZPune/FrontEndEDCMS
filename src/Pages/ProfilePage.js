import React, { useState, useEffect } from "react";
import "../Styling/profilepage.css";
import UserDashboard from "../Components/UserDashboard";
import Navbar from "../Components/Navbar";
import {jwtDecode} from "jwt-decode";

const getDecodedToken = () => {
  try {
    const jwt = localStorage.getItem("token");
    if (jwt) {
      const parsedToken = JSON.parse(jwt);
      if (parsedToken.token) {
        return {
          decoded: jwtDecode(parsedToken.token),
          token: parsedToken.token,
        };
      }
    }
  } catch (error) {
    console.error("Error decoding token:", error);
  }
  return { decoded: null, token: null };
};

const { decoded, token } = getDecodedToken();
const loggedInUserId = decoded?.UserId || "";

const ProfilePage = () => {
  const [userData, setUserData] = useState("");
  const [lastSeen, setLastSeen] = useState("");
  const [timeSpent, setTimeSpent] = useState(0);
  const [result, setResult] = useState(null);

  console.log(result, "resulttttt");

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        if (!loggedInUserId) {
          throw new Error("No valid user ID found.");
        }
        const response = await fetch(
          `http://77.242.26.150:8000/api/User/${loggedInUserId}`
        );
        if (!response.ok) {
          throw new Error(`User not found. Status: ${response.status}`);
        }
        const contentType = response.headers.get("Content-Type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          console.log(data);
          setUserData(data);
          setLastSeen(new Date().toLocaleString());
        } else {
          const text = await response.text();
          throw new Error("Expected JSON but got: " + text);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();

    // Update time spent on profile every minute
    const interval = setInterval(() => {
      setTimeSpent((prevTime) => prevTime + 1);
    }, 60000);

    return () => clearInterval(interval);
  }, [loggedInUserId]);

  useEffect(() => {
    const fetchBusinessData = async () => {
      try {
        const res = await fetch(
          `http://77.242.26.150:8000/api/Business`,
          {
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          throw new Error(`HTTP error: ${res.status}`);
        }
        const data = await res.json();
        setResult(data);
      } catch (err) {
        console.error("Error fetching business data:", err);
      }
    };

    if (loggedInUserId && token) {
      fetchBusinessData();
    }
  }, [loggedInUserId, token]);

  if (!userData) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading user data...</p>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="profile-page-container">
        <div className="profile-header">
          <div className="profile-picture">
            <img
              src={userData.profileImage || "/Assets/default_avatar.png"}
              alt="Profile"
            />
          </div>
          <div className="profile-info">
            <h1>{userData.name}</h1>
            <p>{userData.bio || "No bio available"}</p>
            <p>
              <strong>Role:</strong> {userData.role}
            </p>
            <p>
              <strong>Last Seen:</strong> {lastSeen}
            </p>
            <p>
              <strong>Time Spent on Profile:</strong> {timeSpent} minutes
            </p>
            <p>
              <strong>Businesses Owned :</strong>{" "}
              {result ? JSON.stringify(result.name) : "No businesses"}
            </p>
          </div>
        </div>
        <UserDashboard userData={userData} />
      </div>
    </div>
  );
};

export default ProfilePage;
