"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash, User, Shield } from "lucide-react";

interface AdminUser {
    id: string;
    name: string;
    email: string;
    is_admin: boolean;
    createdAt: string;
}

export default function AdminSettingsPage() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            setUsers(data);
        } catch (error) {
            toast.error("Failed to fetch admins");
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);

        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newUser),
            });

            if (!res.ok) throw new Error("Failed to add user");

            toast.success("Admin user added");
            setShowAddModal(false);
            setNewUser({ name: "", email: "", password: "" });
            fetchUsers();
        } catch (error) {
            toast.error("Failed to add user");
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveAdmin = async (id: string) => {
        if (!confirm("Are you sure you want to remove admin access for this user?")) return;

        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Failed to remove");
            }
            toast.success("Admin access removed");
            fetchUsers();
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Settings</h1>
                    <p className="text-gray-500 mt-1">Manage admin access and system preferences.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Add Admin
                </button>
            </div>

            <div className="bg-white dark:bg-slate-950 border rounded-lg overflow-hidden">
                <div className="p-4 border-b bg-gray-50 dark:bg-slate-900 font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" /> Admin Users
                </div>
                <div className="divide-y">
                    {users.map((user) => (
                        <div key={user.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-gray-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                    <User className="h-5 w-5 text-gray-500" />
                                </div>
                                <div>
                                    <div className="font-medium">{user.name || "Unnamed"}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Active</span>
                                <button
                                    onClick={() => handleRemoveAdmin(user.id)}
                                    className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                                    title="Remove Admin Access"
                                >
                                    <Trash className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-950 p-6 rounded-lg w-full max-w-md space-y-4">
                        <h2 className="text-xl font-bold">Add Admin User</h2>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Name</label>
                                <input
                                    className="w-full p-2 border rounded bg-background"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Email</label>
                                <input
                                    type="email"
                                    className="w-full p-2 border rounded bg-background"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Password</label>
                                <input
                                    type="password"
                                    className="w-full p-2 border rounded bg-background"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 border rounded hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adding}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                                >
                                    {adding && <Loader2 className="h-4 w-4 animate-spin" />} Add
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
