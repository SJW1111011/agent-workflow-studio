import { useState, useEffect } from 'preact/hooks';

// Simple API client
const api = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  async post(url, data) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },
};

// Hook for tasks list
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const data = await api.get('/api/overview');
      setTasks(data.tasks || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return { tasks, loading, error, refresh: load };
}

// Hook for task detail
export function useTaskDetail(taskId) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        const data = await api.get(`/api/tasks/${taskId}`);
        setTask(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [taskId]);

  return { task, loading, error };
}

// Hook for creating task
export function useCreateTask() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  async function create(title, priority = 'P1') {
    try {
      setCreating(true);
      setError(null);
      const result = await api.post('/api/quick', { title, priority });
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setCreating(false);
    }
  }

  return { create, creating, error };
}

// Hook for approve/reject
export function useTaskReview(taskId) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function approve() {
    try {
      setSubmitting(true);
      setError(null);
      await api.post(`/api/tasks/${taskId}/approve`, {});
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  async function reject(feedback) {
    try {
      setSubmitting(true);
      setError(null);
      await api.post(`/api/tasks/${taskId}/reject`, { feedback });
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return { approve, reject, submitting, error };
}
