import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { fetchVimeoThumbnailUrl } from '@/lib/vimeo';

type Props = {
  vimeoUrl: string;
  /** Se definida, usada como capa estática; se a imagem falhar, usa o thumbnail do Vimeo. */
  posterUrl?: string;
  /** Ex.: `rounded-t-xl` nos cartões com cantos superiores arredondados */
  className?: string;
  /** Quando o pai já define altura (ex.: `absolute inset-0` num `aspect-video`), evita `aspect-video` duplicado. */
  fillContainer?: boolean;
};

/**
 * Capa estática (oEmbed) + overlay de hover, sem iframe do Vimeo — evita controles nativos em listagens.
 */
export function VimeoPosterThumb(props: Props) {
  const custom = props.posterUrl?.trim() ?? '';
  /** Remonta ao mudar URL: zera tentativa de fallback sem `setState` em effect. */
  return <VimeoPosterThumbInner key={`${props.vimeoUrl}|${custom}`} {...props} />;
}

function VimeoPosterThumbInner({ vimeoUrl, posterUrl, className, fillContainer }: Props) {
  const custom = posterUrl?.trim();
  const [vimeoThumb, setVimeoThumb] = useState<string | null>(null);
  /** Só após falha da imagem custom é que buscamos o thumb do Vimeo. */
  const [customFailed, setCustomFailed] = useState(false);
  const [vimeoImageBroken, setVimeoImageBroken] = useState(false);

  useEffect(() => {
    if (custom && !customFailed) return;
    if (!vimeoUrl.trim()) return;

    let cancelled = false;
    void (async () => {
      const url = await fetchVimeoThumbnailUrl(vimeoUrl);
      if (!cancelled && url) setVimeoThumb(url);
    })();

    return () => {
      cancelled = true;
    };
  }, [vimeoUrl, custom, customFailed]);

  const showCustom = Boolean(custom && !customFailed);
  const displaySrc = showCustom ? custom : vimeoThumb;

  return (
    <div
      className={clsx(
        'relative w-full overflow-hidden bg-zinc-900',
        fillContainer ? 'absolute inset-0 h-full min-h-0' : 'aspect-video',
        className
      )}
    >
      <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-900" aria-hidden />
      {displaySrc && (showCustom || !vimeoImageBroken) ? (
        <img
          src={displaySrc}
          alt=""
          className="absolute inset-0 z-1 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => {
            if (showCustom) {
              setCustomFailed(true);
            } else {
              setVimeoImageBroken(true);
            }
          }}
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-2 bg-black/15 transition-colors duration-300 group-hover:bg-black/35"
        aria-hidden
      />
    </div>
  );
}
