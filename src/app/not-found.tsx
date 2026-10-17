import { ErrorState, ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-6">
      <ErrorState
        icon="🔍"
        title="Page not found"
        body="That link doesn't point anywhere in Queue Mitra. It may be an old QR code or a typo."
      >
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Go home</ButtonLink>
          <ButtonLink href="/scan" variant="secondary">
            Open demo QR page
          </ButtonLink>
        </div>
      </ErrorState>
    </div>
  );
}
