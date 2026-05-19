import { createFileRoute } from "@tanstack/react-router";
import { NiyatApp } from "@/components/niyat/NiyatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Niyat — Muslim yoshlar uchun AI murabbiy" },
      {
        name: "description",
        content:
          "Niyat — o'zbek tilida gaplashuvchi AI hayot murabbiyi. Ekran vaqti, maqsadlar, namoz va Qur'on bilan niyatli yashash.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <NiyatApp />;
}
