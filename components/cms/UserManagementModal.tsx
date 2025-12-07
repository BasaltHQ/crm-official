"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertUser, getRoles } from "@/actions/cms/users";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: any; // If null, creating new user
}

export function UserManagementModal({ isOpen, onClose, user }: UserManagementModalProps) {
    const [loading, setLoading] = useState(false);
    const [roles, setRoles] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        username: "",
        roleId: "",
        userStatus: "ACTIVE",
        password: "" // Only for new users usually, or password reset
    });

    useEffect(() => {
        // Fetch roles on mount
        getRoles().then(setRoles);
    }, []);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || "",
                email: user.email || "",
                username: user.username || "",
                roleId: user.roleId || "",
                userStatus: user.userStatus || "ACTIVE",
                password: ""
            });
        } else {
            setFormData({
                name: "",
                email: "",
                username: "",
                roleId: "",
                userStatus: "ACTIVE",
                password: ""
            });
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Prepare payload
            const payload: any = {
                ...formData,
                id: user?.id // undefined if new
            };

            // Remove empty password if editing (don't overwrite with empty)
            if (user && !payload.password) delete payload.password;
            // If new user and no password, maybe auto-gen or allow null? let's keep it simple.

            const result = await upsertUser(payload);

            if (result.success) {
                toast.success(user ? "User updated" : "User created");
                onClose();
            } else {
                toast.error(result.error || "Operation failed");
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg bg-zinc-950/95 backdrop-blur-xl border border-white/10 text-white shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-white">{user ? "Edit User" : "Add Team Member"}</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Manage account details, role assignment, and access status.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="flex items-center gap-4 mb-6">
                        <Avatar className="h-16 w-16 border-2 border-white/10">
                            <AvatarImage src={user?.avatar} />
                            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-lg">
                                {formData.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-sm text-zinc-400 mb-2">Profile Picture (Managed via NextAuth Provider usually)</p>
                            {/* Future: File Upload */}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Full Name</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                placeholder="John Doe"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Username</Label>
                            <Input
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                placeholder="jdoe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-zinc-300">Email Address</Label>
                        <Input
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                            placeholder="john@example.com"
                            type="email"
                            required
                        />
                    </div>

                    {!user && (
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Temporary Password</Label>
                            <Input
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="bg-zinc-900/50 border-white/10 text-white placeholder:text-zinc-500 focus:border-blue-500/50 focus:ring-blue-500/20"
                                type="password"
                                placeholder="••••••••"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-zinc-300">Role</Label>
                            <Select
                                value={formData.roleId}
                                onValueChange={(val) => setFormData({ ...formData, roleId: val })}
                            >
                                <SelectTrigger className="bg-zinc-900/50 border-white/10 text-white">
                                    <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id} className="focus:bg-zinc-800 focus:text-white cursor-pointer">{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-zinc-300">Status</Label>
                            <Select
                                value={formData.userStatus}
                                onValueChange={(val) => setFormData({ ...formData, userStatus: val })}
                            >
                                <SelectTrigger className="bg-zinc-900/50 border-white/10 text-white">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                                    <SelectItem value="ACTIVE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Active</SelectItem>
                                    <SelectItem value="PENDING" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Pending</SelectItem>
                                    <SelectItem value="INACTIVE" className="focus:bg-zinc-800 focus:text-white cursor-pointer">Inactive (Suspended)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter className="mt-6 gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="hover:bg-white/5 text-zinc-400 hover:text-white">
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white border-0">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {user ? "Save Changes" : "Create User"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
