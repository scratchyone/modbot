import * as util_functions from '../util_functions.js';
import * as Utils from '../util_functions.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { LogBit } from 'logbit';
const log = new LogBit('LastFM');
import * as Types from '../types.js';
import Discord from 'discord.js';
import fetch from 'node-fetch';
import moment from 'moment';
import SpotifyWebApi from 'spotify-web-api-node';

/** Represents an image with size and URL */
interface Image {
  /** Size of the image */
  size: string;
  /** URL of the image */
  '#text': string;
}

/** Represents a user in LastFM */
interface User {
  /** Username */
  name: string;
  /** User's age */
  age: string;
  /** Indicates if the user is a subscriber (1) or not (0) */
  subscriber: string;
  /** User's real name */
  realname: string;
  /** Bootstrap status */
  bootstrap: string;
  /** Total play count of the user */
  playcount: string;
  /** Total artist count of the user */
  artist_count: string;
  /** Total playlists count of the user */
  playlists: string;
  /** Total track count of the user */
  track_count: string;
  /** Total album count of the user */
  album_count: string;
  /** Array of user's images with different sizes */
  image: Image[];
  /** Registration details of the user */
  registered: {
    /** Unix timestamp of registration */
    unixtime: string;
    /** Registration date in text format */
    '#text': string;
  };
  /** User's country */
  country: string;
  /** User's gender (m for male, f for female, n for not available) */
  gender: string;
  /** URL of the user's LastFM page */
  url: string;
  /** Type of user */
  type: string;
}

/** Represents a recent track in LastFM */
interface RecentTrack {
  /** Artist information */
  artist: {
    /** MusicBrainz ID of the artist */
    mbid: string;
    /** Name of the artist */
    '#text': string;
  };
  /** Streamable status of the track (0 for not streamable, 1 for streamable) */
  streamable: string;
  /** Array of track's images with different sizes */
  image: Image[];
  /** MusicBrainz ID of the track */
  mbid: string;
  /** Album information */
  album: {
    /** MusicBrainz ID of the album */
    mbid: string;
    /** Name of the album */
    '#text': string;
  };
  /** Name of the track */
  name: string;
  /** URL of the track's LastFM page */
  url: string;
  /** Timestamp information of when the track was played */
  date: {
    /** Unix timestamp of the play date */
    uts: string;
    /** Play date in text format */
    '#text': string;
  };
}

/** Represents track information in LastFM */
interface TrackInfo {
  /** Name of the track */
  name: string;
  /** MusicBrainz ID of the track */
  mbid: string;
  /** URL of the track's LastFM page */
  url: string;
  /** Duration of the track in milliseconds */
  duration: string;
  /** Streamable status of the track */
  streamable: {
    /** Streamable status (0 for not streamable, 1 for streamable) */
    '#text': string;
    /** Full track streamable status (0 for not streamable, 1 for streamable) */
    fulltrack: string;
  };
  /** Number of listeners of the track */
  listeners: string;
  /** Play count of the track */
  playcount: string;
  /** Artist information */
  artist: {
    /** Name of the artist */
    name: string;
    /** MusicBrainz ID of the artist */
    mbid: string;
    /** URL of the artist's LastFM page */
    url: string;
  };
  /** Album information */
  album: {
    /** Name of the artist */
    artist: string;
    /** Title of the album */
    title: string;
    /** MusicBrainz ID of the album */
    mbid: string;
    /** URL of the album's LastFM page */
    url: string;
    /** Array of album's images with different sizes */
    image: Image[];
    /** Attributes of the album */
    '@attr': {
      /** Position of the album in the discography */
      position: string;
    };
  };
  /** Top tags of the track */
  toptags: {
    /** Array of tags */
    tag: {
      /** Name of the tag */
      name: string;
      /** URL of the tag's LastFM page */
      url: string;
    }[];
  };
  /** Wiki information about the track */
  wiki: {
    /** Published date of the wiki content */
    published: string;
    /** Summary of the wiki content */
    summary: string;
    /** Full wiki content */
    content: string;
  };
}

/**
 * Represents an artist's similar artist.
 */
interface SimilarArtist {
  /**
   * The name of the similar artist.
   */
  name: string;
  /**
   * The URL of the similar artist's page.
   */
  url: string;
  /**
   * An array of images representing the similar artist.
   */
  image: Image[];
}

/**
 * Represents an artist's tag.
 */
interface ArtistTag {
  /**
   * The name of the tag.
   */
  name: string;
  /**
   * The URL of the tag's page.
   */
  url: string;
}

/**
 * Represents the artist's bio.
 */
interface ArtistBio {
  /**
   * The publication date of the bio.
   */
  published: string;
  /**
   * A summary of the artist's bio.
   */
  summary: string;
  /**
   * The full content of the artist's bio.
   */
  content: string;
}

/**
 * Represents the main artist object.
 */
interface Artist {
  /**
   * The name of the artist.
   */
  name: string;
  /**
   * The MusicBrainz ID of the artist.
   */
  mbid: string;
  /**
   * The URL of the artist's page.
   */
  url: string;
  /**
   * An array of images representing the artist.
   */
  image: Image[];
  /**
   * Indicates if the artist's music is streamable on the platform.
   */
  streamable: string;
  /**
   * Indicates if the artist is currently on tour.
   */
  ontour: string;
  /**
   * An object containing the artist's listener count and play count.
   */
  stats: {
    /**
     * The number of listeners for the artist.
     */
    listeners: string;
    /**
     * The total number of times the artist's music has been played.
     */
    playcount: string;
  };
  /**
   * An object containing a list of similar artists.
   */
  similar: {
    /**
     * An array of similar artists.
     */
    artist: SimilarArtist[];
  };
  /**
   * An object containing a list of the artist's tags.
   */
  tags: {
    /**
     * An array of the artist's tags.
     */
    tag: ArtistTag[];
  };
  /**
   * The artist's biography.
   */
  bio: ArtistBio;
}

/**
 * Represents an instance of the LastFM API, used for retrieving user, track and artist information.
 */
class LastFMApi {
  private apiKey: string;
  private baseUrl: string;

  /**
   * Creates a new instance of the LastFMApi class.
   * @param {string} apiKey - The API key to be used for making requests to the LastFM API.
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://ws.audioscrobbler.com/2.0/';
  }

  /**
   * Fetches data from the LastFM API.
   * @private
   * @param {string} method - The LastFM API method to be called.
   * @param {Record<string, string>} params - An object containing the query parameters to be passed to the API method.
   * @returns {Promise<any>} - A Promise that resolves the JSON data from the LastFM API response.
   * @throws {Error} - Throws an error if the LastFM API returns an error.
   */
  private async fetchLastFM(
    method: string,
    params: Record<string, string>
  ): Promise<any> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('method', method);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('format', 'json');

    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }

    const response = await fetch(url.toString());
    const data = (await response.json()) as any;

    if (data.error) {
      throw new Error(data.message);
    }

    return data;
  }

  /**
   * Retrieves information about a LastFM user.
   * @public
   * @param {string} username - The username of the LastFM user to retrieve information about.
   * @returns {Promise<User>} - A Promise that resolves the user object for the given username.
   */
  public async getUserInfo(username: string): Promise<User> {
    const data = await this.fetchLastFM('user.getInfo', { user: username });
    return data.user;
  }

  /**
   * Retrieves information about the most recent tracks scrobbled by a given LastFM user.
   * @public
   * @param {string} username - The username of the LastFM user to retrieve information about.
   * @param {number} limit - Optional limit to the number of recent tracks to retrieve.
   * @returns {Promise<RecentTrack[]>} - A Promise that resolves an array of the user's recent tracks, sorted in reverse chronological order.
   */
  public async getRecentTracks(
    username: string,
    limit = 10
  ): Promise<RecentTrack[]> {
    const data = await this.fetchLastFM('user.getRecentTracks', {
      user: username,
      limit: limit.toString(),
    });
    return data.recenttracks.track;
  }

  /**
   * Retrieves information about a given LastFM track.
   * @public
   * @param {string} artist - The name of the track's artist.
   * @param {string} track - The name of the LastFM track.
   * @returns {Promise<TrackInfo>} - A Promise that resolves the track object for the given artist and track names.
   */
  public async getTrackInfo(artist: string, track: string): Promise<TrackInfo> {
    const data = await this.fetchLastFM('track.getInfo', { artist, track });
    return data.track;
  }

  /**
   * Retrieves information about a given LastFM artist.
   * @public
   * @param {string} artistName - The name of the artist to retrieve information about.
   * @returns {Promise<Artist>} - A Promise that resolves the artist object for the given artist name.
   */
  async getArtistInfo(artistName: string): Promise<Artist> {
    const params = {
      method: 'artist.getInfo',
      artist: artistName,
    };

    const response = await this.fetchLastFM('GET', params);
    return response.artist;
  }
}

/**
 * Adds commas to a number.
 *
 * @param {number} num - the number to add commas to
 * @returns {string} - the number with commas added
 */
function addCommas(num: number): string {
  // Convert the number to a string for easier manipulation
  const str = num.toString();

  // Split the number into its integer and decimal parts
  const parts = str.split('.');
  const integer = parts[0];
  const decimal = parts[1] || '';

  // Add commas to the integer part
  let result = '';
  for (let i = 0; i < integer.length; i++) {
    if (i > 0 && i % 3 === 0) {
      result = ',' + result;
    }
    result = integer[integer.length - i - 1] + result;
  }

  // Add the decimal part, if it exists
  if (decimal) {
    result += '.' + decimal;
  }

  return result;
}

const link = {
  name: 'lastfm link',
  syntax: 'lastfm link <username: word>',
  explanation: 'Link your LastFM account to your Discord account',
  version: 2,
  permissions: () => process.env.LASTFM_KEY,
  responder: async (ctx: Types.Context, cmd: { username: string }) => {
    if (
      await prisma.lastFmAccounts.findFirst({
        where: { discordUser: ctx.msg.author.id },
      })
    ) {
      throw new util_functions.BotError(
        'user',
        `You already have a LastFM account linked to this Discord account. You can unlink it with \`${ctx.prefix}lastfm unlink\``
      );
    }
    const api = new LastFMApi(process.env.LASTFM_KEY || '');
    try {
      await api.getUserInfo(cmd.username);
    } catch (e) {
      throw new util_functions.BotError(
        'user',
        `The LastFM account \`${cmd.username}\` doesn't exist.`
      );
    }
    await prisma.lastFmAccounts.create({
      data: {
        discordUser: ctx.msg.author.id,
        lastFmUser: cmd.username,
      },
    });
    await ctx.msg.dbReply(
      Utils.embed(
        `Successfully linked your LastFM account \`${cmd.username}\` to your Discord account.`,
        'success'
      )
    );
  },
};
const unlink = {
  name: 'lastfm unlink',
  syntax: 'lastfm unlink',
  explanation: 'Unlink your LastFM account from your Discord account',
  version: 2,
  permissions: () => process.env.LASTFM_KEY,
  responder: async (ctx: Types.Context) => {
    if (
      !(await prisma.lastFmAccounts.findFirst({
        where: { discordUser: ctx.msg.author.id },
      }))
    ) {
      throw new util_functions.BotError(
        'user',
        `You don't have a LastFM account linked to this Discord account. You can link one with \`${ctx.prefix}lastfm link <username>\``
      );
    }
    await prisma.lastFmAccounts.delete({
      where: {
        discordUser: ctx.msg.author.id,
      },
    });
    await ctx.msg.dbReply(
      Utils.embed(
        'Successfully unlinked your LastFM account from your Discord account.',
        'success'
      )
    );
  },
};
const lastfm = {
  name: 'lastfm',
  syntax: 'lastfm/lfm/fm/nowplaying/np/music/m',
  explanation: 'Show your currently playing song on LastFM',
  version: 2,
  permissions: () =>
    process.env.LASTFM_KEY &&
    process.env.SPOTIFY_CLIENT_ID &&
    process.env.SPOTIFY_CLIENT_SECRET,
  responder: async (ctx: Types.Context) => {
    const linkedAccount = await prisma.lastFmAccounts.findFirst({
      where: { discordUser: ctx.msg.author.id },
    });
    if (!linkedAccount) {
      throw new util_functions.BotError(
        'user',
        `You don't have a LastFM account linked to this Discord account. You can link one with \`${ctx.prefix}lastfm link <username>\``
      );
    }
    const api = new LastFMApi(process.env.LASTFM_KEY || '');
    const recentTracks = await api.getRecentTracks(linkedAccount.lastFmUser, 1);
    if (recentTracks.length === 0) {
      throw new util_functions.BotError(
        'user',
        "You don't have any recent tracks on LastFM."
      );
    }
    const track = recentTracks[0];
    const artist = await api.getArtistInfo(track.artist['#text']);

    // credentials are optional
    const spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: 'http://www.example.com/callback',
    });
    spotifyApi.setAccessToken(
      (await spotifyApi.clientCredentialsGrant()).body['access_token']
    );
    const spotifyTracks = await spotifyApi.searchTracks(
      `artist:${track.artist['#text']} track:${track.name} album:${track.album['#text']}`,
      {
        limit: 1,
      }
    );
    const spotifyTrack =
      (spotifyTracks.body.tracks?.items.length || 0) > 0
        ? spotifyTracks.body.tracks?.items[0]
        : undefined;
    const embed = new Discord.MessageEmbed()
      .setFooter(
        track.date
          ? `Last played ${moment(
              parseInt(track.date.uts) * 1000
            ).fromNow()} on LastFM`
          : 'Currently playing on LastFM'
      )
      .setColor('#d51007')
      .setDescription(
        `**Album:** ${track.album['#text']}\n**Playcount:** ${addCommas(
          parseInt(artist.stats.playcount)
        )}`
      );

    if (spotifyTrack) {
      embed
        .setTitle(spotifyTrack.name)
        .setURL(spotifyTrack.external_urls.spotify)
        .setThumbnail(spotifyTrack.album.images[0].url);
      if (spotifyTrack.artists.length > 0) {
        const spotifyArtistId = spotifyTrack.artists[0].id;
        const spotifyArtist = await spotifyApi.getArtist(spotifyArtistId);
        embed.setAuthor({
          name: spotifyTrack.artists[0].name,
          iconURL: spotifyArtist.body.images[0].url,
          url: spotifyTrack.artists[0].external_urls.spotify,
        });
      } else {
        embed.setAuthor(track.artist['#text']);
      }
    } else {
      embed.setTitle(track.name).setAuthor(track.artist['#text']);
    }
    await ctx.msg.dbReply({ embeds: [embed] });
  },
};

export const commandModule = {
  title: 'LastFM',
  description: 'LastFM integration',
  commands: [link, unlink, lastfm],
};
