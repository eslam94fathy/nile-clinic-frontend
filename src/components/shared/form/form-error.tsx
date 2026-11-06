/** Errors with no matching field. None of them may be dropped. */
export function FormError({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive p-3 font-medium text-destructive"
    >
      <ul className="flex flex-col gap-1">
        {messages.map((message, index) => (
          // The backend can repeat a message, and none may be dropped.
          <li key={`${index}-${message}`}>{message}</li>
        ))}
      </ul>
    </div>
  );
}
