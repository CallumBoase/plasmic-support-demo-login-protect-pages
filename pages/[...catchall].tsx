// ./pages/[...catchall].tsx

/* 
  Catchall page that runs for every page EXCEPT /, /login
  These pages are login protected
  
  The routes that render through this page are rendered on-demand (getServerSideProps instead of getStaticProps) 
  because they are login protected. This ensures that the user's session is checked on every request

  This pages is a modified various of the standard Plasmic NextJS loader API catchall page.

  Pages created in Plasmic studio will render using this catchall if it's:
    Page Settings -> URL path is not "/" or "/login"
*/

import type { GetServerSideProps } from "next";

import * as React from "react";
import {
  PlasmicComponent,
  PlasmicRootProvider,
} from "@plasmicapp/loader-nextjs";

import Error from "next/error";
import { useRouter } from "next/router";
import { PLASMIC } from "@/plasmic-init";
import useSWR from "swr";

export default function PlasmicLoaderPage(props: {
  plasmicPath: string;
}) {

  const router = useRouter();

  //Fetch the component (page) data from Plasmic and cache it with SWR
  //Note that when navigating between index.tsx and [...catchall].tsx
  //A warning  from Plasmic will appear in console https://github.com/plasmicapp/plasmic/blob/7117b4c2de9e89f4435db9efa0cba6a00012c297/packages/loader-react/src/loader-shared.ts#L498
  //Because maybeFetchComponentData will fetch designs with query string parameter browserOnly=true here
  //But browserOnly=false from index.tsx
  //Because fetching of Plasmic componet data is happening client side here, but server side in index.tsx
  //This does not appear to matter since the referenced file above seems to gracefully handle this case

  const plasmicComponentFetcher = React.useCallback(async () => {
    return await PLASMIC.maybeFetchComponentData(props.plasmicPath);
  }, [props.plasmicPath]);

  const { data: plasmicData, error, isValidating } = useSWR(
    `plasmicData_${props.plasmicPath}`,
    plasmicComponentFetcher
  );

  //Render the error page if there is an error
  if(error) {
    return <Error statusCode={500} />;
  }

  //Render a loading message if the data is still loading
  if(isValidating && !plasmicData) {
    return <div>Loading...</div>;
  }

  //Render a 404 page if the page is not found in Plasmic
  if ((!isValidating && (!plasmicData || plasmicData.entryCompMetas.length === 0))) {
    return <Error statusCode={404} />;
  }

  //Extract the page meta data from the Plasmic data
  const pageMeta = plasmicData!.entryCompMetas[0]

  //Render the Plasmic component (page)
  return (
    <PlasmicRootProvider
      loader={PLASMIC}
      prefetchedData={plasmicData!}
      prefetchedQueryData={{}}
      pageParams={pageMeta.params}
      pageQuery={router.query}
    >
      <PlasmicComponent component={pageMeta.displayName} />
    </PlasmicRootProvider>
  );
}

//This runs on the server while rendering
//Unlike the pages in the root directory, we run this every time the page is requested with no cache
//This is appropriate because these pages are login protected and only work with a valid session
//We also need to recheck each time the page is requested to ensure the user is still authenticated
export const getServerSideProps: GetServerSideProps = async (context) => {

  //Get the catchall parameter from the page context
  const { catchall } = context.params ?? {};

  //Get the path of the current page
  let plasmicPath = typeof catchall === 'string' ? catchall : Array.isArray(catchall) ? `/${catchall.join('/')}` : '/';

  // Here we would normally determine if the user is authorized to view this page with Supabase here
  // const supabase = createClient(context);
  // const { data: { user } } = await supabase.auth.getUser();
  // const isAuthorized = authorizationCheckFunction(plasmicPath, user);

  //However, for simplicity of this example repo, we hard-code authorized to true or false manually for easy testing
  const isAuthorized = true;

  if(isAuthorized !== true) return {
    redirect: {
      destination: '/login',
      permanent: false,
    }
  }

  //We don't try and fetch the plasmic component data or data on the page here, because getServerSideProps does not cache
  //Therefore we would run this every time without cache, causing slow page navigation
  //Instead, we do that client-side and cache results with SWR (see above)

  return { props: { plasmicPath } };
}