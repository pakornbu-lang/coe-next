import styles from "./PageLoading.module.css";

export default function PageLoading({ variant = "cards" }: { variant?: "cards" | "table" }) {
  return <section className={styles.wrapper} aria-label="กำลังโหลดหน้า">
    <p role="status" aria-live="polite" className={styles.status}>กำลังโหลดข้อมูล…</p>
    <div aria-hidden="true" className={styles.content}>
      <div className={`${styles.shimmer} ${styles.heading}`} />
      <div className={`${styles.shimmer} ${styles.subtitle}`} />
      {variant === "cards" ? <div className={styles.grid}>{[0, 1, 2].map(key =>
        <div key={key} className={styles.card}><div className={`${styles.shimmer} ${styles.cover}`} /><div className={`${styles.shimmer} ${styles.line}`} /><div className={`${styles.shimmer} ${styles.line}`} /><div className={`${styles.shimmer} ${styles.short}`} /></div>
      )}</div> : <div className={styles.card}>{[0, 1, 2, 3, 4].map(key =>
        <div className={styles.row} key={key}><div className={`${styles.shimmer} ${styles.line}`} /><div className={`${styles.shimmer} ${styles.short}`} /></div>
      )}</div>}
    </div>
  </section>;
}
