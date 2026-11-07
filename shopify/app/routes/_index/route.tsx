import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>NOXEL SPECTRA for Shopify</h1>
        <p className={styles.text}>
          Your product photos, ready to sell: clean white background, uniform square format, lighter files and alt text.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li><strong>White background</strong>. Background removal by the NOXEL SPECTRA AI, right in your product pages.</li>
          <li><strong>Uniform grid</strong>. Every product photo on the same square format.</li>
          <li><strong>Always reversible</strong>. The original is kept in your Shopify Files and restored in one click.</li>
        </ul>
      </div>
    </div>
  );
}
