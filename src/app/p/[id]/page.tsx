import { redirect } from "next/navigation";

// Link compartible: /p/<id> abre el mapa con ese lugar seleccionado.
// (Quien lo abre tiene que ser miembro; el middleware lo manda a login si no.)
export default async function PlaceShortLink(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  redirect(`/?place=${id}`);
}
