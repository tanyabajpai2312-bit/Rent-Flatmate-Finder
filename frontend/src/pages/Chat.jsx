import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Chat() {
  const { interestId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [status, setStatus] = useState('connecting');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function init() {
      // Load persisted history first
      try {
        const { data } = await api.get(`/api/chat/${interestId}/messages`);
        if (active) setMessages(data);
      } catch (err) {
        setStatus('error: ' + (err.response?.data?.error || 'failed to load history'));
        return;
      }

      const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
        auth: { token: localStorage.getItem('token') },
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('join_chat', { interestId });
      });

      socket.on('joined_chat', () => setStatus('connected'));
      socket.on('error_message', (msg) => setStatus('error: ' + msg));

      socket.on('new_message', (message) => {
        setMessages((prev) => [...prev, message]);
      });
    }

    init();

    return () => {
      active = false;
      socketRef.current?.disconnect();
    };
  }, [interestId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() || !socketRef.current) return;
    socketRef.current.emit('send_message', { interestId, content: text });
    setText('');
  };

  return (
    <div className="container">
      <h2>Chat</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>Status: {status}</p>
      <div className="chat-window">
        <div className="chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.senderId === user?.id ? 'mine' : 'theirs'}`}>
              <div>{m.content}</div>
              <div className="meta">{m.sender?.name} · {new Date(m.createdAt).toLocaleTimeString()}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form className="chat-input" onSubmit={sendMessage}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
          />
          <button className="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
