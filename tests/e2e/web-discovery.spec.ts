import {test,expect,type Page} from '@playwright/test';

const merchants=(page:Page)=>page.getByTestId('sut-merchant-list');

test('merchant list follows category filter and searches merchants and products',async({page})=>{
  await page.goto('/');
  await expect(merchants(page).getByRole('heading',{level:3})).toHaveCount(7);
  await page.getByTestId('sut-category-shops').click();
  await expect(page.getByTestId('sut-category-shops')).toHaveAttribute('aria-pressed','true');
  await expect(merchants(page).getByRole('link')).toHaveText(['City Tech','The Corner Bookshop']);
  await page.getByTestId('sut-category-all').click();
  await page.getByRole('textbox',{name:'What are you looking for?'}).fill('sourdough');
  await expect(merchants(page).getByRole('link')).toHaveText(['Morning Market']);
  await page.getByRole('textbox',{name:'What are you looking for?'}).fill('piazza');
  await expect(merchants(page).getByRole('link')).toHaveText(['Piazza Local']);
});

test('no search results shows empty states and reset restores the catalogue',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-category-food').click();
  await page.getByRole('textbox',{name:'What are you looking for?'}).fill('zzz-no-match');
  await expect(page.getByText('No matching products.')).toBeVisible();
  await expect(page.getByTestId('sut-merchants-empty')).toContainText('No matching merchants.');
  await expect(merchants(page).getByRole('link')).toHaveCount(0);
  await page.getByTestId('sut-search-reset').click();
  await expect(page.getByRole('textbox',{name:'What are you looking for?'})).toHaveValue('');
  await expect(page.getByTestId('sut-category-all')).toHaveAttribute('aria-pressed','true');
  await expect(merchants(page).getByRole('link')).toHaveCount(7);
});

test('merchant and product detail routes with deep links and back navigation',async({page})=>{
  await page.goto('/');
  await page.getByTestId('sut-merchant-link-piazza-local').click();
  await expect(page).toHaveURL(/#\/merchant\/piazza-local$/);
  const title=page.getByRole('heading',{level:1,name:'Piazza Local'});
  await expect(title).toBeFocused();
  await expect(page.getByRole('navigation',{name:'Breadcrumb'})).toContainText('Piazza Local');
  await page.getByTestId('sut-merchant-add-pizza').click();
  await expect(page.getByRole('button',{name:/Cart, 1/})).toBeVisible();
  await page.getByTestId('sut-product-link-pizza').click();
  await expect(page).toHaveURL(/#\/product\/pizza$/);
  await expect(page.getByRole('heading',{level:1,name:'Margherita pizza'})).toBeFocused();
  await expect(page.getByTestId('sut-product-price')).toHaveText('€11.90');
  await expect(page.getByTestId('sut-product-quantity-pizza')).toHaveText('1');
  await page.goBack();
  await expect(page.getByRole('heading',{level:1,name:'Piazza Local'})).toBeVisible();
  await page.getByTestId('sut-breadcrumb-home').click();
  await expect(page.getByRole('heading',{name:'What are you craving?'})).toBeVisible();
  await expect(page.getByRole('button',{name:/Cart, 1/})).toBeVisible();
  await page.goto('/#/product/flowers');
  await expect(page.getByRole('heading',{level:1,name:'Fresh flowers'})).toBeVisible();
  await expect(page.getByTestId('sut-product-merchant-link')).toHaveText('Bloom & Grow');
});

test('unknown merchant and product ids show a not-found state',async({page})=>{
  await page.goto('/#/merchant/does-not-exist');
  await expect(page.getByTestId('sut-merchant-not-found')).toContainText('not in the preview catalogue');
  await page.goto('/#/product/does-not-exist');
  await expect(page.getByTestId('sut-product-not-found')).toBeVisible();
  await page.getByTestId('sut-back-to-merchants').click();
  await expect(page.getByTestId('sut-merchant-list')).toBeVisible();
});

test('cart increase, decrease and remove keep totals exact; removing the last item empties the cart',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Add Margherita pizza'}).click();
  await page.getByRole('button',{name:'Add Sourdough loaf'}).click();
  await page.getByRole('button',{name:/Cart, 2/}).click();
  const cart=page.getByTestId('sut-cart-dialog');
  await cart.getByTestId('sut-cart-increase-pizza').click();
  await cart.getByTestId('sut-cart-increase-pizza').click();
  await expect(cart.getByTestId('sut-cart-quantity-pizza')).toHaveText('3');
  await expect(cart.getByTestId('sut-cart-line-total-pizza')).toContainText('€35.70');
  await expect(cart.getByTestId('sut-cart-subtotal')).toHaveText('€40.20');
  await cart.getByTestId('sut-cart-decrease-pizza').click();
  await expect(cart.getByTestId('sut-cart-subtotal')).toHaveText('€28.30');
  await cart.getByTestId('sut-cart-remove-pizza').click();
  await expect(cart.getByTestId('sut-cart-line-pizza')).toHaveCount(0);
  await expect(cart.getByTestId('sut-cart-subtotal')).toHaveText('€4.50');
  await expect(cart.getByTestId('sut-checkout-disabled')).toBeDisabled();
  await expect(cart).toContainText('Checkout is disabled until payment and delivery integrations are ready.');
  await cart.getByTestId('sut-cart-remove-bread').click();
  await expect(cart.getByTestId('sut-cart-empty')).toBeVisible();
  await expect(cart.getByTestId('sut-cart-subtotal')).toHaveCount(0);
  await expect(cart.getByTestId('sut-checkout-disabled')).toHaveCount(0);
  await expect(cart.getByRole('heading',{name:/Your basket/})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:/Cart, 0/})).toBeFocused();
});

test('product detail quantity controls and localized currency in CS and DE',async({page})=>{
  await page.goto('/#/product/headphones');
  await page.getByTestId('sut-product-add-headphones').click();
  await expect(page.getByTestId('sut-product-increase-headphones')).toBeFocused();
  await page.getByTestId('sut-product-increase-headphones').click();
  await expect(page.getByTestId('sut-product-quantity-headphones')).toHaveText('2');
  await page.getByTestId('sut-product-decrease-headphones').click();
  await expect(page.getByTestId('sut-product-quantity-headphones')).toHaveText('1');
  await page.getByTestId('sut-product-remove-headphones').click();
  await expect(page.getByTestId('sut-product-add-headphones')).toBeFocused();
  await page.getByTestId('sut-breadcrumb-home').click();
  await page.getByLabel('Language').selectOption('cs');
  await page.getByTestId('sut-merchant-link-city-tech').click();
  await expect(page.getByRole('heading',{name:'Produkty'})).toBeVisible();
  await page.getByTestId('sut-product-link-headphones').click();
  await expect(page.getByTestId('sut-product-price')).toHaveText(/39,90\s€/);
  await expect(page.getByText('Prodává')).toBeVisible();
  await page.getByTestId('sut-breadcrumb-home').click();
  await page.getByLabel('Jazyk').selectOption('de');
  await page.getByTestId('sut-merchant-link-city-tech').click();
  await page.getByTestId('sut-merchant-add-headphones').click();
  await page.getByRole('button',{name:/Warenkorb, 1/}).click();
  await expect(page.getByTestId('sut-cart-subtotal')).toHaveText(/39,90\s€/);
  await expect(page.getByTestId('sut-checkout-disabled')).toHaveText('Zur Kasse bald verfügbar');
});

test('keyboard navigation, landmarks and visible focus on discovery routes',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeVisible();
  const link=page.getByTestId('sut-merchant-link-green-table');
  await link.focus();
  await expect(link).toHaveCSS('outline-style','solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{level:1,name:'Green Table'})).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('sut-product-link-bowl')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Add Seasonal veggie bowl'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:/Cart, 1/})).toBeVisible();
});

test('detail pages fit a phone viewport without horizontal scrolling',async({page})=>{
  await page.setViewportSize({width:375,height:740});
  for(const path of ['/','/#/merchant/morning-market','/#/product/apples']){
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow,path).toBeLessThanOrEqual(0);
  }
});
