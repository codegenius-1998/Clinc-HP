import { content } from "../data/template";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import styles from "./Schedule.module.css";

/** variant: "table" — 診療時間。淡いシアンの帯 + 上端に植物文様。表は罫線を最小限に。 */
export function ScheduleTable() {
  const { heading, cornerLabel, emptyMark, days, rows, notes } = content.schedule;
  return (
    <section id="schedule" className={`${styles.section} nj-reveal`}>
      <Container>
        <SectionHeading ja={heading.ja} en={heading.en} align="center" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={styles.corner}>
                  {cornerLabel}
                </th>
                {days.map((d) => (
                  <th key={d} scope="col">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.marks.map((m, i) => (
                    <td key={i} className={m === "▲" ? styles.tri : undefined}>
                      {m ?? emptyMark}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className={styles.notes}>
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
