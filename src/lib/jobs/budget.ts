/** A timeout stops waiting; provider writes still require stable idempotency keys. */
export class MaintenanceDeadlineError extends Error {
  constructor() {
    super("Maintenance deadline reached.");
  }
}
export async function withinBudget<T>(
  work: () => Promise<T>,
  deadline: number,
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new MaintenanceDeadlineError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new MaintenanceDeadlineError()),
          remaining,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
