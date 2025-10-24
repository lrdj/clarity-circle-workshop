---
layout: unbranded
title: Component Demos
permalink: /demos/
---

<h1 class="govuk-heading-xl">GOV.UK component demos</h1>

<p class="govuk-body">The GOV.UK Frontend package ships example HTML templates for each component under <code>assets/govuk/components/*/template-*.html</code>. These are HTML fragments, not full pages, so opening them directly will not include the site’s CSS/JS. Below, we preview a subset by loading the fragment into this page so our CSS/JS applies.</p>

<p class="govuk-body">You can still open raw files if you want: they’re linked next to each preview.</p>

<div class="govuk-!-margin-bottom-6">
  <h2 class="govuk-heading-m">Accordion
    <small class="govuk-!-font-size-16">(
      <a class="govuk-link" href="{{ site.baseurl }}/assets/govuk/components/accordion/template-default.html">open raw</a>
    )</small>
  </h2>
  <div class="cl-demo" data-src="{{ site.baseurl }}/assets/govuk/components/accordion/template-default.html"></div>
  <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">
</div>

<div class="govuk-!-margin-bottom-6">
  <h2 class="govuk-heading-m">Details
    <small class="govuk-!-font-size-16">(
      <a class="govuk-link" href="{{ site.baseurl }}/assets/govuk/components/details/template-default.html">open raw</a>
    )</small>
  </h2>
  <div class="cl-demo" data-src="{{ site.baseurl }}/assets/govuk/components/details/template-default.html"></div>
  <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">
</div>

<div class="govuk-!-margin-bottom-6">
  <h2 class="govuk-heading-m">Radios
    <small class="govuk-!-font-size-16">(
      <a class="govuk-link" href="{{ site.baseurl }}/assets/govuk/components/radios/template-default.html">open raw</a>
    )</small>
  </h2>
  <div class="cl-demo" data-src="{{ site.baseurl }}/assets/govuk/components/radios/template-default.html"></div>
  <hr class="govuk-section-break govuk-section-break--l govuk-section-break--visible">
</div>

<div class="govuk-!-margin-bottom-6">
  <h2 class="govuk-heading-m">Tabs
    <small class="govuk-!-font-size-16">(
      <a class="govuk-link" href="{{ site.baseurl }}/assets/govuk/components/tabs/template-default.html">open raw</a>
    )</small>
  </h2>
  <div class="cl-demo" data-src="{{ site.baseurl }}/assets/govuk/components/tabs/template-default.html"></div>
</div>

<script>
  // Load demo fragments into the page, then init GOV.UK components within each container
  (function () {
    const containers = Array.from(document.querySelectorAll('.cl-demo[data-src]'))
    containers.forEach(async (el) => {
      const src = el.getAttribute('data-src')
      try {
        const res = await fetch(src)
        const html = await res.text()
        el.innerHTML = html
        if (window.GOVUKFrontend && typeof window.GOVUKFrontend.initAll === 'function') {
          window.GOVUKFrontend.initAll({ scope: el })
        }
      } catch (e) {
        el.innerHTML = '<div class="govuk-error-summary"><div class="govuk-error-summary__body">Failed to load: ' + src + '</div></div>'
        // eslint-disable-next-line no-console
        console.error('Failed to load demo', src, e)
      }
    })
  })()
  </script>
