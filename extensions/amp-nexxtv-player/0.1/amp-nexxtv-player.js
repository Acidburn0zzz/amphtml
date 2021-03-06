/**
 * Copyright 2017 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertAbsoluteHttpOrHttpsUrl} from '../../../src/url';
import {isLayoutSizeDefined} from '../../../src/layout';
import {user} from '../../../src/log';
import {
  installVideoManagerForDoc,
} from '../../../src/service/video-manager-impl';
import {removeElement} from '../../../src/dom';
import {isObject} from '../../../src/types';
import {tryParseJson} from '../../../src/json';
import {listen} from '../../../src/event-helper';
import {VideoEvents} from '../../../src/video-interface';
import {videoManagerForDoc} from '../../../src/video-manager';

/**
 * @implements {../../../src/video-interface.VideoInterface}
 */
class AmpNexxtvPlayer extends AMP.BaseElement {

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private {?Element} */
    this.iframe_ = null;

    /** @private {?string} */
    this.videoIframeSrc_ = null;

    /** @private {?Function} */
    this.unlistenMessage_ = null;

    /** @private {?Promise} */
    this.playerReadyPromise_ = null;

    /** @private {?Function} */
    this.playerReadyResolver_ = null;
  }

  /**
   * @param {boolean=} opt_onLayout
   * @override
   */
  preconnectCallback(opt_onLayout) {
    this.preconnect.url(this.getVideoIframeSrc_(), opt_onLayout);
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  buildCallback() {
    this.playerReadyPromise_ = new Promise(resolve => {
      this.playerReadyResolver_ = resolve;
    });

    const iframe = this.element.ownerDocument.createElement('iframe');
    this.iframe_ = iframe;

    this.applyFillContent(iframe);
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', 'true');

    this.element.appendChild(iframe);

    installVideoManagerForDoc(this.element);
    videoManagerForDoc(this.element).register(this);
  }

  getVideoIframeSrc_() {
    if (this.videoIframeSrc_) {
      return this.videoIframeSrc_;
    }

    const mediaId = user().assert(
      this.element.getAttribute('data-mediaid'),
      'The data-mediaid attribute is required for <amp-nexxtv-player> %s',
      this.element);

    const client = user().assert(this.element.getAttribute('data-client'),
      'The data-client attribute is required for <amp-nexxtv-player> %s',
      this.element);

    const start = this.element.getAttribute('data-seek-to') || 0;
    const mode = this.element.getAttribute('data-mode') || 'static';
    const streamtype = this.element.getAttribute('data-streamtype') || 'video';
    const origin = this.element.getAttribute('data-origin')
      || 'https://embed.nexx.cloud/';

    let src = '';
    src += origin;

    if (streamtype !== 'video') {
      src += `${encodeURIComponent(streamtype)}/`;
    }

    src += `${encodeURIComponent(client)}/`;
    src += `${encodeURIComponent(mediaId)}`;
    src += `?start=${encodeURIComponent(String(start))}`;
    src += `&datamode=${encodeURIComponent(mode)}&amp=1`;

    this.videoIframeSrc_ = assertAbsoluteHttpOrHttpsUrl(src);

    return this.videoIframeSrc_;
  }

  /** @override */
  viewportCallback(visible) {
    this.element.dispatchCustomEvent(VideoEvents.VISIBILITY, {visible});
  }

  /** @override */
  layoutCallback() {
    this.iframe_.src = this.getVideoIframeSrc_();

    this.unlistenMessage_ = listen(this.iframe_,'message', event => {
      this.handleNexxMessages_(event);
    });

    return this.loadPromise(this.iframe_)
      .then(() => {
        this.element.dispatchCustomEvent(VideoEvents.LOAD);
        this.playerReadyResolver_(this.iframe_);
      });
  }

  pauseCallback() {
    if (this.iframe_) {
      this.pause();
    }
  }

  /** @override */
  unlayoutCallback() {
    if (this.iframe_) {
      removeElement(this.iframe_);
      this.iframe_ = null;
    }

    if (this.unlistenMessage_) {
      this.unlistenMessage_();
    }

    return true;
  }

  sendCommand_(command) {
    this.iframe_.contentWindow./*OK*/postMessage(JSON.stringify({
      'cmd': command,
    }), '*');
  };

  // emitter
  handleNexxMessages_(event) {
    const data = isObject(event.data) ? event.data : tryParseJson(event.data);
    if (data === undefined) {
      return; // We only process valid JSON.
    }

    if (data.cmd == 'onload') {
      this.element.dispatchCustomEvent(VideoEvents.LOAD);
      this.playerReadyResolver_(this.iframe_);
    } else if (data.cmd == 'play') {
      this.element.dispatchCustomEvent(VideoEvents.PLAY);
    } else if (data.cmd == 'pause') {
      this.element.dispatchCustomEvent(VideoEvents.PAUSE);
    } else if (data.cmd == 'mute') {
      this.element.dispatchCustomEvent(VideoEvents.MUTED);
    } else if (data.cmd == 'unmute') {
      this.element.dispatchCustomEvent(VideoEvents.UNMUTED);
    }
  }

  // VideoInterface Implementation
  // only send in json format
  play() {
    this.playerReadyPromise_.then(() => {
      this.sendCommand_('play');
    });
  }

  pause() {
    this.playerReadyPromise_.then(() => {
      this.sendCommand_('pause');
    });
  }

  mute() {
    this.playerReadyPromise_.then(() => {
      this.sendCommand_('mute');
    });
  }

  unmute() {
    this.playerReadyPromise_.then(() => {
      this.sendCommand_('unmute');
    });
  }

  supportsPlatform() {
    return true;
  }

  isInteractive() {
    return true;
  }

  showControls() {
  }

  hideControls() {
  }
}

AMP.registerElement('amp-nexxtv-player', AmpNexxtvPlayer);
