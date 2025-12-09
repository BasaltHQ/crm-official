import LoadingComponent from "@/components/LoadingComponent";

type Props = {};

const SuspenseLoading = (props: Props) => {
  return (
    <div className="flex justify-center items-center w-full h-full min-h-[300px]">
      <LoadingComponent />
    </div>
  );
};

export default SuspenseLoading;
