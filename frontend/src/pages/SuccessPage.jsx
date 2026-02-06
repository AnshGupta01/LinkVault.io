import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Copy, Clock, Share2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SuccessPage() {
    const { shareId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);

    const { shareUrl, expiresAt } = location.state || {};

    const handleCopy = async () => {
        if (shareUrl) {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!shareUrl) {
        navigate('/');
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-12 px-4">
            <div className="max-w-2xl mx-auto">
                <Card className="border-green-800">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-green-900 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <CardTitle>Share Created Successfully!</CardTitle>
                                <CardDescription>
                                    Your link is ready to share
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">
                                Share Link
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={shareUrl}
                                    readOnly
                                    className="font-mono text-sm"
                                />
                                <Button onClick={handleCopy} variant="outline" disabled={copied}>
                                    {copied ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <Clock className="h-5 w-5 text-blue-400 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-blue-100 mb-1">
                                        Expiry Information
                                    </h4>
                                    <p className="text-sm text-blue-300">
                                        This link will expire{' '}
                                        {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
                                    </p>
                                    <p className="text-xs text-blue-400 mt-1">
                                        {new Date(expiresAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => navigate(`/share/${shareId}`)}
                                variant="outline"
                                className="flex-1"
                            >
                                View Share
                            </Button>
                            <Button onClick={() => navigate('/')} className="flex-1">
                                Create Another
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
