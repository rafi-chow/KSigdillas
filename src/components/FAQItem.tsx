import { Plus } from "lucide-react";

export function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <details className="faq-item">
      <summary>
        {question}
        <Plus aria-hidden="true" />
      </summary>
      <p>{answer}</p>
    </details>
  );
}
