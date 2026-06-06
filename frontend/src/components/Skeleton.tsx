import type { CSSProperties } from 'react'

/* ────────────────────────────────────────────────────────────
   Bloc animé de base
──────────────────────────────────────────────────────────── */
export function Skeleton({
  width = '100%', height = '14px', radius = '6px', style,
}: {
  width?: string; height?: string; radius?: string; style?: CSSProperties
}) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
      flexShrink: 0,
      ...style,
    }} />
  )
}

/* ────────────────────────────────────────────────────────────
   Carte de liste (grille véhicules / contacts / immobilier)
──────────────────────────────────────────────────────────── */
export function SkeletonCard() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden', borderTop: '3px solid rgba(255,255,255,0.06)' }}>
      <div style={{ padding: '18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <Skeleton width="40px" height="40px" radius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width="60%" height="15px" />
          <Skeleton width="40%" height="11px" />
          <Skeleton width="80px" height="10px" radius="20px" />
        </div>
        <Skeleton width="48px" height="18px" radius="20px" />
      </div>
      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 18px', background: 'rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between' }}>
        <Skeleton width="80px" height="11px" />
        <Skeleton width="50px" height="11px" />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Ligne de liste (document-row, interaction, etc.)
──────────────────────────────────────────────────────────── */
export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
      <Skeleton width="18px" height="18px" radius="4px" />
      <Skeleton width="55%" height="13px" />
      <Skeleton width="60px" height="11px" style={{ marginLeft: 'auto' }} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Tuile stat (Dashboard)
──────────────────────────────────────────────────────────── */
export function SkeletonStatTile() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px 20px', display: 'flex', gap: '14px', alignItems: 'center' }}>
      <Skeleton width="42px" height="42px" radius="12px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton width="50px" height="22px" />
        <Skeleton width="80px" height="11px" />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Squelette complet — grille de cartes (Véhicules, Contacts…)
──────────────────────────────────────────────────────────── */
export function SkeletonGridPage({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <Skeleton width="60px" height="10px" />
          <Skeleton width="180px" height="22px" />
        </div>
        <Skeleton width="140px" height="36px" radius="10px" />
      </div>
      {/* Barre recherche */}
      <Skeleton width="100%" height="40px" radius="10px" />
      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Squelette Dashboard
──────────────────────────────────────────────────────────── */
export function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width="70px" height="10px" />
        <Skeleton width="200px" height="22px" />
      </div>
      {/* Bannière */}
      <Skeleton width="100%" height="60px" radius="12px" />
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {Array.from({ length: 7 }).map((_, i) => <SkeletonStatTile key={i} />)}
      </div>
      {/* Panneaux */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Skeleton width="50px" height="9px" />
                <Skeleton width="120px" height="16px" />
              </div>
              <Skeleton width="60px" height="26px" radius="8px" />
            </div>
            {Array.from({ length: 4 }).map((_, j) => <SkeletonRow key={j} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Squelette page avec onglets + liste (Agenda, Finances, Docs)
──────────────────────────────────────────────────────────── */
export function SkeletonTabPage({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', padding: '0 8px', background: 'var(--card)', borderRadius: '16px 16px 0 0', borderBottom: '1px solid var(--border)' }}>
        {[100, 140, 120].map((w, i) => <div key={i} style={{ padding: '12px 16px' }}><Skeleton width={`${w}px`} height="13px" /></div>)}
      </div>
      {/* Panel */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: 'none', marginTop: '16px', borderRadius: '16px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton width="50px" height="9px" />
            <Skeleton width="140px" height="16px" />
          </div>
          <Skeleton width="70px" height="24px" radius="20px" />
        </div>
        {/* Formulaire inline */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)' }}>
          {[200, 120, 100, 80, 80].map((w, i) => <Skeleton key={i} width={`${w}px`} height="36px" radius="8px" />)}
        </div>
        {/* Lignes */}
        {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    </div>
  )
}
