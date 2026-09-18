/** 30-min time slots 7:00am–6:30pm, value in 24h, label in 12h */
export const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = [{ value: "", label: "— hora —" }];
  for (let h = 7; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) break;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const h12 = h % 12 || 12;
      const suffix = h >= 12 ? "pm" : "am";
      const label = `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
      opts.push({ value, label });
    }
  }
  return opts;
})();
