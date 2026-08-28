import * as v from 'valibot';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { spfi, SPFx } from '@pnp/sp';
import '@pnp/sp/webs';
import '@pnp/sp/lists';
import '@pnp/sp/items';
import type { WebPartContext } from '@microsoft/sp-webpart-base';
import '../../../app.css';

const FeedbackSchema = v.object({
  title: v.pipe(v.string(), v.minLength(3, 'Title needs 3 characters'), v.maxLength(100)),
  email: v.pipe(v.string(), v.email('Enter a valid email')),
  category: v.picklist(['Bug', 'Feature', 'Question'] as const),
  message: v.pipe(v.string(), v.minLength(10, 'Message needs 10 characters')),
  rating: v.pipe(v.number(), v.minValue(1), v.maxValue(5))
});

type Feedback = v.InferOutput<typeof FeedbackSchema>;

type Props = {
  description: string;
  listTitle: string;
  siteUrl: string;
  context: WebPartContext;
};

export default function FeedbackForm(props: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const form = useForm({
    defaultValues: {
      title: '',
      email: '',
      category: 'Feature' as Feedback['category'],
      message: '',
      rating: 5
    } as Feedback,
    validators: {
      onSubmit: ({ value }) => {
        const r = v.safeParse(FeedbackSchema, value);
        if (!r.success) return 'Validation failed';
        return undefined;
      }
    },
    onSubmit: async ({ value }) => {
      const parsed = v.parse(FeedbackSchema, value);
      setStatus('saving');
      setErrorMsg('');
      try {
        const sp = spfi().using(SPFx(props.context));
        await sp.web.lists.getByTitle(props.listTitle).items.add({
          Title: parsed.title,
          Email: parsed.email,
          Category: parsed.category,
          Message: parsed.message,
          Rating: parsed.rating
        });
        setStatus('done');
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }
  });

  return (
    <div className="mx-auto max-w-[640px] rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">{props.description}</h2>
      <p className="mt-1 text-sm text-zinc-500">React 19 + Tailwind + Valibot + TanStack Form → {props.listTitle} list. Compiler auto-memoizes this form.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="mt-6 space-y-4"
      >
        <form.Field name="title" validators={{ onChange: ({ value }) => (!value || value.length < 3 ? 'Min 3 chars' : undefined) }}>
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Title</label>
              <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="Feature request" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
              {field.state.meta.errors[0] ? <p className="mt-1 text-xs text-red-600">{String(field.state.meta.errors[0])}</p> : null}
            </div>
          )}
        </form.Field>

        <form.Field name="email" validators={{ onChange: ({ value }) => (!value || !value.includes('@') ? 'Valid email required' : undefined) }}>
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Email</label>
              <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} placeholder="you@contoso.com" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
              {field.state.meta.errors[0] ? <p className="mt-1 text-xs text-red-600">{String(field.state.meta.errors[0])}</p> : null}
            </div>
          )}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Category</label>
              <select value={field.state.value} onChange={(e) => field.handleChange(e.target.value as Feedback['category'])} className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm">
                <option value="Bug">Bug</option>
                <option value="Feature">Feature</option>
                <option value="Question">Question</option>
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="message">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Message</label>
              <textarea value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} onBlur={field.handleBlur} rows={4} placeholder="Describe…" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900" />
            </div>
          )}
        </form.Field>

        <form.Field name="rating">
          {(field) => (
            <div>
              <label className="block text-sm font-medium text-zinc-700">Rating: {field.state.value}</label>
              <input type="range" min={1} max={5} value={field.state.value} onChange={(e) => field.handleChange(Number(e.target.value))} className="mt-1 w-full" />
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <button type="submit" disabled={!canSubmit || status === 'saving'} className="inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50">
              {isSubmitting || status === 'saving' ? 'Submitting…' : 'Submit to SharePoint'}
            </button>
          )}
        </form.Subscribe>
      </form>

      {status === 'done' ? <p className="mt-3 text-sm text-green-600">Saved to list “{props.listTitle}”.</p> : null}
      {status === 'error' ? <p className="mt-3 text-sm text-red-600">Error: {errorMsg}</p> : null}
      <p className="mt-4 text-xs text-zinc-400">Site: {props.siteUrl}</p>
    </div>
  );
}
