const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="bg-white/80 backdrop-blur-lg border border-blue-50 rounded-3xl shadow-xl p-10 text-center space-y-4">
      <div className="text-6xl font-black text-slate-900">404</div>
      <p className="text-slate-600">The page you’re looking for doesn’t exist.</p>
      <a href="/" className="inline-block px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold hover:shadow-lg">Back to home</a>
    </div>
  </div>
);

export default NotFound;
