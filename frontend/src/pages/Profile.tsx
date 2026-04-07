import { useEffect, useState } from 'react';
import api from '../services/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface ProfileData {
  id: number;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

const Profile = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ username: '', email: '', name: '', avatar: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/auth/profile');
        setProfile(res.data);
        setForm({
          username: res.data.username || '',
          email: res.data.email || '',
          name: res.data.name || '',
          avatar: res.data.avatar || '',
          password: '',
        });
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      let avatarUrl = form.avatar;
      if (avatarFile) {
        const url = await uploadToDataUrl(avatarFile);
        avatarUrl = url;
      }
      const payload: any = { ...form };
      payload.avatar = avatarUrl;
      if (!payload.password) delete payload.password;
      const res = await api.put('/auth/profile', payload);
      setProfile(res.data);
      setMessage('Profile updated');
      setForm((p) => ({ ...p, password: '' }));
      setAvatarFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSaving(true);
    setPwError('');
    setPwMessage('');
    try {
      await api.put('/auth/password', pw);
      setPwMessage('Password updated');
      setPw({ currentPassword: '', newPassword: '' });
    } catch (err: any) {
      setPwError(err.response?.data?.error || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading profile...</div>;
  if (!profile) return <div className="p-8 text-center text-red-600">Profile not found</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 text-slate-100">
      <Card>
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-wide">Profile</p>
            <h1 className="text-3xl font-black text-white">Account settings</h1>
            <p className="text-slate-300">Update your contact info and credentials.</p>
          </div>
          <div className="flex items-center gap-3">
            {profile.avatar ? (
              <img src={profile.avatar} alt="avatar" className="w-12 h-12 rounded-full object-cover border border-slate-700" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white grid place-items-center text-lg font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold">
              Role: {profile.role}
            </div>
          </div>
        </div>

        {message && <div className="p-3 mb-4 text-sm text-emerald-200 bg-emerald-900/40 rounded-lg border border-emerald-700">{message}</div>}
        {error && <div className="p-3 mb-4 text-sm text-red-200 bg-red-900/40 rounded-lg border border-red-700">{error}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
            <Input label="Username" value={form.username} onChange={(e) => handleChange('username', e.target.value)} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} required />
            <Input label="Avatar URL" value={form.avatar} onChange={(e) => handleChange('avatar', e.target.value)} placeholder="https://..." />
            <label className="block space-y-1">
              <span className="text-sm font-semibold text-slate-200">Upload Avatar</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-200"
              />
            </label>
          </div>
          <Input label="New Password (optional)" type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="••••••••" />
          <Button disabled={saving} loading={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-wide">Security</p>
            <h2 className="text-xl font-bold text-white">Change password</h2>
          </div>
        </div>
        {pwMessage && <div className="p-3 mb-3 text-sm text-emerald-200 bg-emerald-900/40 rounded border border-emerald-700">{pwMessage}</div>}
        {pwError && <div className="p-3 mb-3 text-sm text-red-200 bg-red-900/40 rounded border border-red-700">{pwError}</div>}
        <form onSubmit={handlePassword} className="space-y-3">
          <Input
            label="Current password"
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            required
          />
          <Input
            label="New password"
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            required
          />
          <Button type="submit" loading={pwSaving} className="w-full sm:w-auto">
            {pwSaving ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Profile;

// simple helper: convert image to data URL (placeholder for real upload)
const uploadToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
