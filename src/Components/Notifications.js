import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { FaBell } from 'react-icons/fa';
import '../Styling/Notifications.css';

const API_BASE = 'http://77.242.26.150:8000';

const getToken = () => {
  const raw = localStorage.getItem('token') || localStorage.getItem('authToken');
  if (!raw || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token || parsed;
  } catch {
    return raw;
  }
};

const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

export default function Notifications() {
  const [invites, setInvites] = useState([]);             
  const [notifications, setNotifications] = useState([]); 
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/Business/employees/pending`,
          { headers: getHeaders() }
        );
        if (!res.ok) return;
        const pending = await res.json();
        setInvites(pending.map(inv => ({
          businessId:   inv.businessId,
          businessName: inv.name,
          invitedAt:    inv.requestedAt,
        })));
      } catch (err) {
        console.error('Error loading pending invites:', err);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/api/Notification`, {
          headers: getHeaders(),
        });
        if (!res.ok) return;
        const notes = await res.json();
        setNotifications(notes);
      } catch (err) {
        console.error('Error loading notifications:', err);
      }
    })();
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const connection = new HubConnectionBuilder()
      .withUrl(`${API_BASE}/notificationHub`, { accessTokenFactory: () => token })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build();

    connection.start().catch(err => console.error('SignalR connect failed:', err));

    connection.on('ReceiveEmployeeInvitation', inv => {
      setInvites(prev => [
        ...prev,
        { businessId: inv.businessId, businessName: inv.businessName, invitedAt: inv.invitedAt }
      ]);
    });

    connection.on('ReceiveNotification', note => {
      console.log('⏰ Received notification:', note);
      setNotifications(prev => [
        { id: note.Id, message: note.Message, createdAt: note.CreatedAt },
        ...prev
      ]);
    });

    return () => {
      connection.stop().catch(err => console.error('SignalR stop failed:', err));
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = e => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const respondInvite = async (businessId, approve) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/Business/employees/respond/${businessId}?approve=${approve}`,
        { method: 'PUT', headers: getHeaders() }
      );
      if (res.ok) {
        setInvites(prev => prev.filter(inv => inv.businessId !== businessId));
      } else {
        alert(`Failed to ${approve ? 'accept' : 'decline'} invitation.`);
      }
    } catch (err) {
      console.error('Error responding to invitation:', err);
      alert(`Failed to ${approve ? 'accept' : 'decline'} invitation.`);
    }
  };

  const clearNotifications = async () => {
    try {
      await Promise.all(
        notifications.map(n =>
          fetch(
            `${API_BASE}/api/Notification/${n.id}/read`,
            { method: 'PUT', headers: getHeaders() }
          )
        )
      );
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing notifications:', err);
      alert('Failed to clear notifications.');
    }
  };

  const totalCount = invites.length + notifications.length;

  return (
    <div ref={wrapperRef} className="notification-wrapper">
      <FaBell
        className="notification-bell"
        onClick={() => setOpen(o => !o)}
      />
      {totalCount > 0 && (
        <span className="badge">{totalCount}</span>
      )}

      {open && (
        <div className="notifications-panel">
          {notifications.length > 0 && (
            <div className="clear-all">
              <button onClick={clearNotifications} className="clear-all-btn">
                Clear All
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div className="invitations-section">
              <div className="section-title">Invitations</div>
              {invites.map(inv => (
                <div key={inv.businessId} className="invitation-item">
                  <div className="invitation-content">
                    <div>Invitation from {inv.businessName}</div>
                    <div className="invitation-time">
                      {new Date(inv.invitedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => respondInvite(inv.businessId, true)}
                      className="invite-action-btn"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondInvite(inv.businessId, false)}
                      className="invite-action-btn"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="notifications-section">
              <div className="section-title">Notifications</div>
              {notifications.map(n => (
                <div key={n.id} className="notification-item">
                  <div className="notification-message">{n.message}</div>
                  <div className="notification-time">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {invites.length === 0 && notifications.length === 0 && (
            <div className="no-items">No New Notifications</div>
          )}
        </div>
      )}
    </div>
  );
}
