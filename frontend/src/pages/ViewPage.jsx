import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Download, Lock, Eye, Clock, CheckCircle2, XCircle, FileText, File as FileIcon, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';

const API_URL = import.meta.env.VITE_API_URL;

export default function ViewPage() {
    const { shareId } = useParams();
    const navigate = useNavigate();
    const [share, setShare] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [passwordRequired, setPasswordRequired] = useState(false);
    const [copied, setCopied] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeletePrompt, setShowDeletePrompt] = useState(false);
    const lastShareIdRef = useRef(null);

    useEffect(() => {
        if (lastShareIdRef.current === shareId) return;
        lastShareIdRef.current = shareId;
        fetchShare();
    }, [shareId]);

    const fetchShare = async (pwd = null) => {
        setLoading(true);
        setError('');

        try {
            const url = pwd
                ? `${API_URL}/share/${shareId}?password=${encodeURIComponent(pwd)}`
                : `${API_URL}/share/${shareId}`;

            const response = await axios.get(url);
            setShare(response.data);
            setPasswordRequired(false);
        } catch (err) {
            if (err.response?.data?.passwordProtected) {
                setPasswordRequired(true);
                setError('');
            } else {
                setError(err.response?.data?.error || 'Failed to load share');
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (password.trim()) {
            fetchShare(password);
        }
    };

    const handleCopy = async () => {
        if (share?.textContent) {
            await navigator.clipboard.writeText(share.textContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        setDownloadLoading(true);
        const downloadUrl = password
            ? `${API_URL}/download/${shareId}?password=${encodeURIComponent(password)}`
            : `${API_URL}/download/${shareId}`;

        window.location.href = downloadUrl;
        setTimeout(() => setDownloadLoading(false), 1000);
    };

    const handleDelete = async (passwordForDelete = null) => {
        // Check if share is password-protected (either from flag or if user entered password to view it)
        const isPasswordProtected = share?.passwordProtected || !!password;

        // If share is password-protected and no password provided, use viewing password or show prompt
        if (isPasswordProtected && !passwordForDelete) {
            // If they already entered the password to view, use that for deletion
            if (password) {
                passwordForDelete = password;
            } else {
                // Otherwise, show the password prompt
                setShowDeletePrompt(true);
                return;
            }
        }

        // Only show confirmation if we have password (or don't need one)
        if (!window.confirm('Are you sure you want to delete this share? This action cannot be undone.')) {
            setShowDeletePrompt(false);
            return;
        }

        setDeleteLoading(true);
        try {
            const deleteUrl = passwordForDelete
                ? `${API_URL}/share/${shareId}?password=${encodeURIComponent(passwordForDelete)}`
                : `${API_URL}/share/${shareId}`;

            await axios.delete(deleteUrl);
            setShowDeletePrompt(false);
            setDeletePassword('');
            setError('Share deleted successfully');
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            if (err.response?.status === 401) {
                setError('Wrong password. Please try again.');
                setDeletePassword('');
                // Keep the prompt open for retry
            } else {
                setError(err.response?.data?.error || 'Failed to delete share');
                setShowDeletePrompt(false);
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (passwordRequired) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
                <div className="max-w-md mx-auto">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Password Required
                            </CardTitle>
                            <CardDescription>
                                This share is password protected
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="password">Enter Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        autoFocus
                                    />
                                </div>
                                {error && (
                                    <p className="text-sm text-red-400">{error}</p>
                                )}
                                <Button type="submit" className="w-full">
                                    Unlock
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
                <div className="max-w-md mx-auto">
                    <Card className="border-red-800">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-400">
                                <XCircle className="h-5 w-5" />
                                {error.includes('expired') ? 'Link Expired' : 'Link Not Found'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-400">
                                {error.includes('expired')
                                    ? 'This link has expired and is no longer available. Please ask the sender for a fresh link.'
                                    : error.includes('not found')
                                        ? 'The link you are looking for does not exist or has been deleted.'
                                        : error}
                            </p>
                            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                                Create New Share
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (!share) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Metadata Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            {share.contentType === 'text' ? (
                                <FileText className="h-5 w-5" />
                            ) : (
                                <FileIcon className="h-5 w-5" />
                            )}
                            {share.contentType === 'text' ? 'Text Share' : 'File Share'}
                        </CardTitle>
                        <CardDescription>
                            Created {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                                <Clock className="h-4 w-4 text-slate-500" />
                                <span className="text-slate-400">
                                    Expires {formatDistanceToNow(new Date(share.expiresAt), { addSuffix: true })}
                                </span>
                            </div>
                            {share.maxViews && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 text-slate-400">
                                            <Eye className="h-4 w-4 text-slate-500" />
                                            Views: {share.currentViews}/{share.maxViews}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-400 h-2 rounded-full transition-all"
                                            style={{
                                                width: `${Math.min((share.currentViews / share.maxViews) * 100, 100)}%`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            )}
                            {share.oneTimeView && (
                                <div className="flex items-center gap-2 text-sm text-amber-400">
                                    <Eye className="h-4 w-4" />
                                    <span>One-time view (will be deleted after this)</span>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Content Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {share.contentType === 'text' ? (
                            <div className="space-y-4">
                                <div className="bg-slate-900 rounded-lg p-4 max-h-[500px] overflow-auto">
                                    <pre className="whitespace-pre-wrap font-mono text-sm text-slate-100">
                                        {share.textContent}
                                    </pre>
                                </div>
                                <Button onClick={handleCopy} variant="outline" className="w-full" disabled={copied}>
                                    {copied ? (
                                        <>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy to Clipboard
                                        </>
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-slate-900 rounded-lg p-6 text-center">
                                    <FileIcon className="mx-auto h-16 w-16 text-slate-400 mb-4" />
                                    <h3 className="font-semibold text-white mb-2">
                                        {share.fileMetadata.originalName}
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-1">
                                        {share.fileMetadata.mimeType}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {(share.fileMetadata.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                                <Button onClick={handleDownload} className="w-full" disabled={downloadLoading}>
                                    <Download className="mr-2 h-4 w-4" />
                                    {downloadLoading ? 'Downloading...' : 'Download File'}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {showDeletePrompt && (
                    <Card className="border-red-800">
                        <CardHeader>
                            <CardTitle className="text-red-400">Password Required to Delete</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="deletePassword">Enter Password</Label>
                                <Input
                                    id="deletePassword"
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => setDeletePassword(e.target.value)}
                                    placeholder="Enter password to confirm deletion"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => handleDelete(deletePassword)}
                                    className="w-full bg-red-600 hover:bg-red-700"
                                    disabled={deleteLoading || !deletePassword.trim()}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                                </Button>
                                <Button
                                    onClick={() => { setShowDeletePrompt(false); setDeletePassword(''); }}
                                    variant="outline"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="flex gap-2 justify-center">
                    <Button onClick={() => handleDelete()} variant="destructive" disabled={deleteLoading}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleteLoading ? 'Deleting...' : 'Delete Share'}
                    </Button>
                    <Button onClick={() => navigate('/')} variant="ghost">
                        Create Your Own Share
                    </Button>
                </div>
            </div>
        </div>
    );
}
