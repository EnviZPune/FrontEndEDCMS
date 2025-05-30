import React, { useState, useEffect, useRef } from 'react';
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { FaBell } from 'react-icons/fa';

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
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const loadPending = async () => {
      const token = getToken();
      if (!token) return;
      try {
        const res = await fetch(
          `${API_BASE}/api/Business/employees/pending`,
          { headers: getHeaders() }
        );
        if (!res.ok) return;
        const pending = await res.json();
        setInvites(pending.map(be => ({
          businessId:   be.businessId,
          businessName: be.businessName,
          invitedAt:    be.invitedAt
        })));
      } catch (err) {
        console.error('Error loading pending invites:', err);
      }
    };
    loadPending();
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
        {
          businessId:   inv.businessId,
          businessName: inv.businessName,
          invitedAt:    inv.invitedAt
        }
      ]);
    });

    return () => connection.stop();
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

  const acceptInvite = async businessId => {
    try {
      const res = await fetch(
        `${API_BASE}/api/Business/${businessId}/employees/respond?approve=true`,
        { method: 'PUT', headers: getHeaders() }
      );
      if (res.ok) {
        setInvites(prev => prev.filter(inv => inv.businessId !== businessId));
      } else {
        alert('Failed to accept invitation.');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      alert('Failed to accept invitation.');
    }
  };

  const declineInvite = async businessId => {
    try {
      const res = await fetch(
        `${API_BASE}/api/Business/${businessId}/employees/respond?approve=false`,
        { method: 'PUT', headers: getHeaders() }
      );
      if (res.ok) {
        setInvites(prev => prev.filter(inv => inv.businessId !== businessId));
      } else {
        alert('Failed to decline invitation.');
      }
    } catch (err) {
      console.error('Error declining invitation:', err);
      alert('Failed to decline invitation.');
    }
  };

  return (
    <div
      ref={wrapperRef}
      className="notification-wrapper"
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <FaBell
        className="bell-icon"
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', fontSize: '1.4em', color: '#fff' }}
      />
      {invites.length > 0 && (
        <span
          className="badge"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            background: 'red',
            color: '#fff',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '0.75em'
          }}
        >
          {invites.length}
        </span>
      )}

      {open && (
        <div
          className="notifications-panel"
          style={{
            position: 'absolute',
            top: '2em',
            right: 0,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            borderRadius: 4,
            width: 260,
            zIndex: 1000,
            padding: 8
          }}
        >
          {invites.length === 0 ? (
            <div style={{ padding: 8 }}>No invitations</div>
          ) : (
            invites.map(inv => (
              <div
                key={inv.businessId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid #eee'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9em' }}>
                    <strong>{inv.businessName}</strong>
                  </div>
                  <div style={{ fontSize: '0.75em', color: '#555' }}>
                    Invited at {new Date(inv.invitedAt).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => acceptInvite(inv.businessId)}
                    style={{ padding: '4px 8px', fontSize: '0.75em' }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => declineInvite(inv.businessId)}
                    style={{ padding: '4px 8px', fontSize: '0.75em' }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
