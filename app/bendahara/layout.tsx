export default function BendaharaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-4 md:p-8 max-w-4xl mx-auto">
        {children}
      </main>
    </div>
  );
}
