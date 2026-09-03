import type { Profile } from "@/lib/types";

export function Avatar({ profile, size = 24 }: { profile: Profile; size?: number }) {
  const initials = profile.display_name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profile.avatar_url}
      alt={profile.display_name}
      title={profile.display_name}
      width={size}
      height={size}
      className="rounded-full border-2 border-white object-cover dark:border-zinc-900"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      title={profile.display_name}
      className="grid place-items-center rounded-full border-2 border-white font-semibold text-white dark:border-zinc-900"
      style={{ width: size, height: size, background: profile.color, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function Avatars({ ids, profiles, size = 24 }: { ids: string[]; profiles: Profile[]; size?: number }) {
  const list = ids.map((id) => profiles.find((p) => p.id === id)).filter((p): p is Profile => !!p);
  return (
    <span className="flex -space-x-1.5">
      {list.map((p) => <Avatar key={p.id} profile={p} size={size} />)}
    </span>
  );
}
