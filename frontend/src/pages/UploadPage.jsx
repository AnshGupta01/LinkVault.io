import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Upload, FileText, File, Clock, Lock, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Label } from '@/components/ui/input';
import { DateTimePicker } from '@/components/ui/date-time-picker';

const API_URL = import.meta.env.VITE_API_URL;

export default function UploadPage() {
    const navigate = useNavigate();
    const [uploadType, setUploadType] = useState('text');
    const [textContent, setTextContent] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [expiryDateTime, setExpiryDateTime] = useState();
    const [password, setPassword] = useState('');
    const [oneTimeView, setOneTimeView] = useState(false);
    const [maxViews, setMaxViews] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                setError('File size must be less than 50MB');
                return;
            }
            setSelectedFile(file);
            setError('');
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                setError('File size must be less than 50MB');
                return;
            }
            setSelectedFile(file);
            setError('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const formData = new FormData();

            if (uploadType === 'text') {
                if (!textContent.trim()) {
                    setError('Please enter some text');
                    setLoading(false);
                    return;
                }
                formData.append('text', textContent);
            } else {
                if (!selectedFile) {
                    setError('Please select a file');
                    setLoading(false);
                    return;
                }
                formData.append('file', selectedFile);
            }

            if (expiryDateTime) {
                formData.append('expiryDate', expiryDateTime.toISOString());
            }
            if (password) {
                formData.append('password', password);
            }
            if (oneTimeView) {
                formData.append('oneTimeView', 'true');
            }
            if (maxViews) {
                formData.append('maxViews', maxViews);
            }

            const response = await axios.post(`${API_URL}/upload`, formData);

            navigate(`/success/${response.data.shareId}`, {
                state: {
                    shareUrl: response.data.shareUrl,
                    expiresAt: response.data.expiresAt,
                },
            });
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2">
                        LinkVault
                    </h1>
                    <p className="text-slate-400">
                        Share text and files securely with expiring links
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Create a Share</CardTitle>
                                <CardDescription>
                                    Upload text or a file to generate a secure shareable link
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex gap-4">
                                    <Button
                                        type="button"
                                        variant={uploadType === 'text' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => setUploadType('text')}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Text
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={uploadType === 'file' ? 'default' : 'outline'}
                                        className="flex-1"
                                        onClick={() => setUploadType('file')}
                                    >
                                        <File className="mr-2 h-4 w-4" />
                                        File
                                    </Button>
                                </div>

                                {uploadType === 'text' ? (
                                    <div className="space-y-2">
                                        <Label htmlFor="text">Your Text</Label>
                                        <Textarea
                                            id="text"
                                            placeholder="Enter or paste your text here..."
                                            value={textContent}
                                            onChange={(e) => setTextContent(e.target.value)}
                                            className="min-h-[300px] font-mono text-sm"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="file">Select File</Label>
                                        <div
                                            onDragEnter={handleDrag}
                                            onDragLeave={handleDrag}
                                            onDragOver={handleDrag}
                                            onDrop={handleDrop}
                                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                                                ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                                : 'border-slate-700 hover:border-primary'
                                                }`}
                                        >
                                            <input
                                                id="file"
                                                type="file"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />
                                            <label htmlFor="file" className="cursor-pointer block">
                                                <Upload className={`mx-auto h-12 w-12 mb-4 transition-colors ${dragActive ? 'text-primary' : 'text-slate-400'
                                                    }`} />
                                                {selectedFile ? (
                                                    <div className="space-y-2">
                                                        <p className="text-sm font-medium text-white">
                                                            {selectedFile.name}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className={`text-sm transition-colors ${dragActive
                                                            ? 'text-primary font-medium'
                                                            : 'text-slate-400'
                                                            }`}>
                                                            {dragActive ? 'Drop your file here' : 'Click to upload or drag and drop'}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            Maximum file size: 50MB
                                                        </p>
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="shadow-lg">
                                <CardHeader>
                                    <CardTitle>Optional Settings</CardTitle>
                                    <CardDescription>
                                        Customize expiry, security, and access controls
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Clock className="h-4 w-4" />
                                            Expiry Date & Time
                                        </Label>
                                        <DateTimePicker
                                            value={expiryDateTime}
                                            onChange={setExpiryDateTime}
                                        />
                                        <p className="text-xs text-slate-500">
                                            Default: 10 minutes from now
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="flex items-center gap-2">
                                            <Lock className="h-4 w-4" />
                                            Password Protection
                                        </Label>
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="Optional password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={oneTimeView}
                                                onChange={(e) => setOneTimeView(e.target.checked)}
                                                className="h-4 w-4 rounded border-slate-300"
                                            />
                                            <span className="text-sm flex items-center gap-2">
                                                <Eye className="h-4 w-4" />
                                                One-time view
                                            </span>
                                        </label>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="maxViews">Maximum Views</Label>
                                        <Input
                                            id="maxViews"
                                            type="number"
                                            min="1"
                                            placeholder="Unlimited"
                                            value={maxViews}
                                            onChange={(e) => setMaxViews(e.target.value)}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            {error && (
                                <div className="p-3 bg-red-900/20 border border-red-800 rounded-md">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" disabled={loading}>
                                {loading ? 'Creating...' : 'Create Share'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
