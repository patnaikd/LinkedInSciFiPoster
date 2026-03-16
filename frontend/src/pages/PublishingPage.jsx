import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCopy,
  Download,
  ExternalLink,
  CheckCircle,
  Loader2,
  ImageOff,
  Plus,
  History,
  ArrowLeft,
} from 'lucide-react';
import { getPost } from '../services/api';

export default function PublishingPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
  });

  const selectedImg = post?.images?.find(img => img.is_selected);

  const handleCopy = async () => {
    if (!post?.content) return;
    await navigator.clipboard.writeText(post.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <ClipboardCopy className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Publish to LinkedIn</h1>
        </div>

        {/* Step 1: Copy post text */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">1</span>
              <h2 className="text-base font-semibold text-white">Copy your post text</h2>
            </div>
            <span className={`text-sm ${(post?.content?.length || 0) > 3000 ? 'text-red-400' : 'text-slate-500'}`}>
              {post?.content?.length || 0} characters
            </span>
          </div>
          <div className="p-5">
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 text-slate-300 text-sm leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap mb-4">
              {post?.content || 'No content yet.'}
            </div>
            <button
              onClick={handleCopy}
              disabled={!post?.content}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-300" />
              ) : (
                <ClipboardCopy className="w-4 h-4" />
              )}
              {copied ? 'Copied!' : 'Copy Post Text'}
            </button>
          </div>
        </div>

        {/* Step 2: Download image */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-4 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">2</span>
            <h2 className="text-base font-semibold text-white">Download your image</h2>
          </div>
          <div className="p-5">
            {selectedImg ? (
              <div className="flex items-center gap-5">
                <img
                  src={`/api/image/${selectedImg.id}`}
                  alt="Post image"
                  className="w-32 h-auto rounded-lg border border-slate-700 object-cover"
                />
                <div>
                  <p className="text-slate-400 text-sm mb-3">Generated in Authoring step</p>
                  <a
                    href={`/api/image/download/${postId}`}
                    download="post-image.png"
                    className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Image
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-500">
                <ImageOff className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">
                  No image selected.{' '}
                  <button
                    onClick={() => navigate(`/author/${postId}`)}
                    className="text-cyan-400 hover:underline"
                  >
                    Go back to Authoring
                  </button>{' '}
                  to generate and select one.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 3: Post on LinkedIn */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 bg-cyan-600 text-white text-xs font-bold rounded-full">3</span>
            <h2 className="text-base font-semibold text-white">Post on LinkedIn</h2>
          </div>
          <div className="p-5">
            <ol className="text-slate-300 text-sm leading-loose list-decimal list-inside space-y-1 mb-5">
              <li>Open LinkedIn and click <strong className="text-white">"Start a post"</strong></li>
              <li>Paste your copied text <span className="text-slate-500">(Ctrl+V / ⌘V)</span></li>
              <li>Click the <strong className="text-white">photo icon</strong> and upload your downloaded image</li>
              <li>Review and click <strong className="text-white">"Post"</strong></li>
            </ol>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open LinkedIn
            </a>
          </div>
        </div>

        {/* Bottom actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/author/${postId}`)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Authoring
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Another Post
          </button>
          <button
            onClick={() => navigate('/history')}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-4 py-2.5 rounded-lg font-medium transition-colors"
          >
            <History className="w-4 h-4" />
            View History
          </button>
        </div>
      </div>
    </div>
  );
}
